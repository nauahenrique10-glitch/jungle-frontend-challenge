import { CanceledError, isAxiosError } from 'axios'
import { queryOptions } from '@tanstack/react-query'
import { queryClient } from '@/app/query-client'
import { http } from './http'
import type { AuthApiError, AuthResult, AuthSession, LoginInput, RegisterInput, SessionState, PrivateProfileResponse } from '@/types/auth'
import { getGuestCartId, rotateGuestCartId } from './guest-cart'

export const sessionKey = ['auth', 'session'] as const
export const authTokenKey = 'kurio:auth-token'
const readToken = () => { try { return localStorage.getItem(authTokenKey) } catch { return null } }
let activeToken = readToken()
let generation = 0
export const authGeneration = () => generation
let authOperation: AbortController | null = null
const privateControllers = new Set<AbortController>()
const privateCleanups = new Set<() => void>()
export function onPrivateCleanup(cleanup: () => void) { privateCleanups.add(cleanup); return () => { privateCleanups.delete(cleanup) } }
export const socketCredential = () => activeToken
export function expireCurrentSession(sessionId: string) { if (currentSession()?.id === sessionId) applySession(null, null, 'expired') }
export const currentSession = () => queryClient.getQueryData<SessionState>(sessionKey)?.session ?? null
export const privateKeys = {
 resource: (session: AuthSession, resource: 'profile' | 'wallets' | 'favorites' | 'cart' | 'orders' | 'quote' | 'order') => ['private', session.user.id, session.id, generation, resource] as const,
}
function clearPrivateData() {
 privateCleanups.forEach(cleanup => cleanup())
 privateControllers.forEach(controller => controller.abort())
 privateControllers.clear()
 void queryClient.cancelQueries({ queryKey: ['private'] })
 queryClient.removeQueries({ queryKey: ['private'] })
 void queryClient.cancelQueries({ queryKey: ['guest'] })
 queryClient.removeQueries({ queryKey: ['guest'] })
 queryClient.getMutationCache().getAll().filter(mutation => mutation.options.meta?.private === true).forEach(mutation => queryClient.getMutationCache().remove(mutation))
}
function applySession(session: AuthSession | null, token: string | null, reason?: SessionState['reason']): SessionState {
 if (currentSession()?.id !== session?.id || activeToken !== token) { generation++; clearPrivateData() }
 activeToken = token
 if (token) localStorage.setItem(authTokenKey, token)
 else localStorage.removeItem(authTokenKey)
 const result: SessionState = { session, reason }
 queryClient.setQueryData(sessionKey, result)
 return result
}
function beginTransition(reason?: SessionState['reason']) {
 generation++
 void queryClient.cancelQueries({ queryKey: sessionKey, exact: true })
 const token = activeToken
 applySession(null, null, reason)
 clearPrivateData()
 return { stamp: generation, token }
}
const authorization = (token: string | null) => token ? { Authorization: `Bearer ${token}` } : {}
export async function fetchSession(signal?: AbortSignal): Promise<SessionState> {
 const stamp = generation
 const token = readToken()
 try {
  const { data } = await http.get<{ session: AuthSession }>('/auth/session', { signal, headers: authorization(token) })
  if (stamp !== generation || token !== readToken()) throw new CanceledError('Sessão substituída.')
  return applySession(data.session, token)
 } catch (error) {
  if (stamp !== generation || token !== readToken()) throw new CanceledError('Sessão substituída.')
  if (isAxiosError<AuthApiError>(error) && error.response?.status === 401) {
   const previous = queryClient.getQueryData<SessionState>(sessionKey)
   return applySession(null, null, error.response.data.code === 'SESSION_EXPIRED' ? 'expired' : previous?.reason)
  }
  throw error
 }
}
export const sessionOptions = () => queryOptions({ queryKey: sessionKey, queryFn: ({ signal }) => fetchSession(signal), staleTime: 15_000, retry: false, refetchOnMount: false, refetchOnWindowFocus: 'always' as const })

export async function authenticate(kind: 'login' | 'register', input: LoginInput | RegisterInput): Promise<SessionState> {
 if (authOperation) throw new Error('Aguarde a operação em andamento.')
 const controller = new AbortController()
 authOperation = controller
 const guestId = getGuestCartId()
 const { stamp, token } = beginTransition()
 try {
  const payload = kind === 'login' ? { email: input.email, password: input.password } : input
  const { data } = await http.post<AuthResult>(`/auth/${kind}`, payload, { signal: controller.signal, headers: { ...authorization(token), 'X-Kurio-Guest': guestId } })
  if (stamp !== generation || controller.signal.aborted) throw new CanceledError('Sessão substituída.')
  const result = applySession(data.session, data.token)
  rotateGuestCartId()
  return result
 } finally { if (authOperation === controller) authOperation = null }
}
export async function logout(): Promise<void> {
 if (authOperation) throw new Error('Aguarde a operação em andamento.')
 const controller = new AbortController()
 authOperation = controller
 const { token, stamp } = beginTransition('logout')
 try { await http.post('/auth/logout', {}, { headers: authorization(token), signal: controller.signal }) }
 catch (error) {
  if (stamp === generation && !controller.signal.aborted) queryClient.setQueryData<SessionState>(sessionKey, { session: null, reason: 'logout', logoutError: 'Sessão local encerrada. Não foi possível confirmar o logout no simulador.' })
  throw error
 } finally { if (authOperation === controller) authOperation = null }
}
export function synchronizeExternalSession() {
 if (readToken() === activeToken) return
 generation++
 authOperation?.abort()
 void queryClient.cancelQueries({ queryKey: sessionKey, exact: true })
 activeToken = readToken()
 clearPrivateData()
 queryClient.setQueryData<SessionState>(sessionKey, { session: null })
 void queryClient.invalidateQueries({ queryKey: sessionKey, exact: true })
}

/** Toda consulta privada captura identidade e credencial antes do HTTP, e revalida antes de aceitar resposta/401. */
export async function requestForSession<T>(session: AuthSession, signal: AbortSignal | undefined, request: (context: { signal: AbortSignal; headers: Record<string, string> }) => Promise<T>): Promise<T> {
 const stamp = generation
 const token = activeToken
 const valid = () => stamp === generation && token === activeToken && token === readToken() && currentSession()?.id === session.id && currentSession()?.user.id === session.user.id
 if (!token || !valid()) throw new CanceledError('Consulta de uma sessão anterior.')
 const controller = new AbortController()
 const abort = () => controller.abort()
 signal?.addEventListener('abort', abort, { once: true })
 if (signal?.aborted) controller.abort()
 privateControllers.add(controller)
 try {
  const result = await request({ signal: controller.signal, headers: { Authorization: `Bearer ${token}`, 'X-Kurio-User': session.user.id, 'X-Kurio-Session': session.id } })
  if (!valid() || controller.signal.aborted) throw new CanceledError('Resposta de uma sessão anterior.')
  return result
 } catch (error) {
  if (!valid() || controller.signal.aborted) throw new CanceledError('Resposta de uma sessão anterior.')
  if (isAxiosError(error) && error.response?.status === 401) applySession(null, null, 'expired')
  throw error
 } finally { privateControllers.delete(controller); signal?.removeEventListener('abort', abort) }
}
export async function getPrivateProfile(session: AuthSession, signal?: AbortSignal): Promise<PrivateProfileResponse> {
 return requestForSession(session, signal, async context => {
  const { data } = await http.get<PrivateProfileResponse>('/account/profile', context)
  if (data.userId !== session.user.id || data.sessionId !== session.id || data.profile.id !== session.user.id) throw new CanceledError('Resposta não corresponde ao usuário solicitado.')
  return data
 })
}

/** Anonymous requests share the auth lifetime, so login/logout abort and discard old guest work too. */
export async function requestForGuest<T>(guestId: string, signal: AbortSignal | undefined, request: (context: { signal: AbortSignal; headers: Record<string, string> }) => Promise<T>): Promise<T> {
 const stamp = generation
 const valid = () => stamp === generation && !activeToken && !readToken() && !currentSession() && getGuestCartId() === guestId
 if (!valid()) throw new CanceledError('Contexto de visitante substituído.')
 const controller = new AbortController()
 const abort = () => controller.abort()
 signal?.addEventListener('abort', abort, { once: true })
 if (signal?.aborted) abort()
 privateControllers.add(controller)
 try {
  const result = await request({ signal: controller.signal, headers: { 'X-Kurio-Guest': guestId } })
  if (!valid() || controller.signal.aborted) throw new CanceledError('Resposta de visitante substituído.')
  return result
 } catch (error) {
  if (!valid() || controller.signal.aborted) throw new CanceledError('Resposta de visitante substituído.')
  throw error
 } finally { privateControllers.delete(controller); signal?.removeEventListener('abort', abort) }
}
