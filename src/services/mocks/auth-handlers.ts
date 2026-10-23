import { delay, http, HttpResponse } from 'msw'
import { validateAuth } from '@/features/account/auth-validation'
import type { AuthResult, AuthSession, AuthUser, RegisterInput } from '@/types/auth'
import { passwordVerifier, tokenHash, withAuthDatabase, type AuthDatabase } from './auth-store'
import { CommerceFailure, mergeGuestCart } from './commerce-store'

const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
export const authScenarios = ['success', 'invalid-credentials', 'conflict', 'validation', 'expired', 'error500', 'latency', 'short-session'] as const
function scenario() { return localStorage.getItem('kurio:auth-scenario') || import.meta.env.VITE_AUTH_SCENARIO || 'success' }
const error = (status: number, code: string, message: string, fields?: object) => HttpResponse.json({ code, message, fields }, { status })
async function simulate() {
 const configured = scenario()
 await delay(configured === 'latency' ? 1400 : 100)
 return configured === 'error500' ? error(500, 'AUTH_UNAVAILABLE', 'Serviço de autenticação temporariamente indisponível.') : null
}
async function body(request: Request): Promise<RegisterInput> {
 let data: Record<string, unknown> = {}
 try { const value = await request.json(); if (value && typeof value === 'object' && !Array.isArray(value)) data = value } catch { /* Validação devolve erros associados aos campos. */ }
 const text = (field: string) => typeof data[field] === 'string' ? data[field] as string : ''
 return { username: text('username').trim().toLowerCase(), email: text('email').trim().toLowerCase(), password: text('password'), confirmPassword: text('confirmPassword') }
}
async function hashFromRequest(request: Request) { return tokenHash(request.headers.get('Authorization')?.replace(/^Bearer /, '') || '') }
function authTransaction(run: (db: AuthDatabase) => Promise<Response>) {
 return withAuthDatabase(run).catch(error => {
  if (error instanceof CommerceFailure) return HttpResponse.json({ code: error.code, message: error.message, fields: error.fields }, { status: error.status })
  throw error
 })
}
export async function current(db: AuthDatabase, request: Request) {
 const hash = await hashFromRequest(request)
 const record = db.sessions.find(item => item.tokenHash === hash)
 if (!record) return { failure: error(401, 'SESSION_REQUIRED', 'Entre para continuar.') } as const
 if (record.expiresAt <= Date.now() || scenario() === 'expired') {
  // Retain an expired credential tombstone until the next issue/logout. Socket
  // and REST checks racing on the same token must all report SESSION_EXPIRED.
  record.expiresAt = Math.min(record.expiresAt, Date.now())
  if (scenario() === 'expired') localStorage.setItem('kurio:auth-scenario', 'success')
  return { failure: error(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.') } as const
 }
 const user = db.users.find(item => item.profile.id === record.userId)?.profile
 if (!user) return { failure: error(401, 'SESSION_REQUIRED', 'Entre para continuar.') } as const
 if (request.headers.has('X-Kurio-User') && (request.headers.get('X-Kurio-User') !== user.id || request.headers.get('X-Kurio-Session') !== record.id)) return { failure: error(403, 'SESSION_MISMATCH', 'A sessão não corresponde a esta consulta.') } as const
 const session: AuthSession = { id: record.id, user, expiresAt: new Date(record.expiresAt).toISOString() }
 return { session } as const
}
async function issue(db: AuthDatabase, user: AuthUser, request: Request): Promise<AuthResult> {
 mergeGuestCart(db, user.id, request.headers.get('X-Kurio-Guest'))
 const oldHash = await hashFromRequest(request)
 db.sessions = db.sessions.filter(record => record.tokenHash !== oldHash && record.expiresAt > Date.now())
 const token = `${crypto.randomUUID()}${crypto.randomUUID()}`
 const record = { id: crypto.randomUUID(), tokenHash: await tokenHash(token), userId: user.id, expiresAt: Date.now() + (scenario() === 'short-session' ? 4000 : 30 * 60_000) }
 db.sessions.push(record)
 return { token, session: { id: record.id, user, expiresAt: new Date(record.expiresAt).toISOString() } }
}
export const authHandlers = [
 http.post(`${base}/auth/register`, async ({ request }) => {
  const failure = await simulate(); if (failure) return failure
  const input = await body(request)
  const fields = validateAuth(input, true)
  if (scenario() === 'validation') fields.username = 'Nome de usuário recusado pelo simulador.'
  if (Object.keys(fields).length) return error(422, 'VALIDATION_ERROR', 'Confira os campos indicados.', fields)
  const salt = crypto.randomUUID()
  const verifier = await passwordVerifier(input.password, salt)
  return authTransaction(async db => {
   const conflicts: Record<string, string> = {}
   if (scenario() === 'conflict' || db.users.some(user => user.profile.email === input.email)) conflicts.email = 'Este e-mail já está cadastrado.'
   if (db.users.some(user => user.profile.username.toLowerCase() === input.username)) conflicts.username = 'Este nome de usuário já está em uso.'
   if (Object.keys(conflicts).length) return error(409, 'USER_EXISTS', 'Já existe um usuário com esses dados.', conflicts)
   const profile: AuthUser = { id: `user-${crypto.randomUUID()}`, email: input.email, username: input.username, displayName: input.username, ens: null, walletNickname: null, avatarUrl: null }
   db.users.push({ profile, salt, verifier })
   return HttpResponse.json(await issue(db, profile, request), { status: 201 })
  })
 }),
 http.post(`${base}/auth/login`, async ({ request }) => {
  const failure = await simulate(); if (failure) return failure
  const input = await body(request)
  const fields = validateAuth(input, false)
  if (scenario() === 'validation') fields.email = 'E-mail recusado pelo simulador.'
  if (Object.keys(fields).length) return error(422, 'VALIDATION_ERROR', 'Confira os campos indicados.', fields)
  return authTransaction(async db => {
   const user = db.users.find(item => item.profile.email === input.email)
   const valid = user && await passwordVerifier(input.password, user.salt) === user.verifier
   if (!valid || scenario() === 'invalid-credentials') return error(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.')
   return HttpResponse.json(await issue(db, user!.profile, request))
  })
 }),
 http.post(`${base}/auth/logout`, async ({ request }) => {
  const failure = await simulate(); if (failure) return failure
  return withAuthDatabase(async db => { const hash = await hashFromRequest(request); db.sessions = db.sessions.filter(item => item.tokenHash !== hash); return new HttpResponse(null, { status: 204 }) })
 }),
 http.get(`${base}/auth/session`, async ({ request }) => {
  const failure = await simulate(); if (failure) return failure
  return withAuthDatabase(async db => { const result = await current(db, request); return result.failure ?? HttpResponse.json({ session: result.session }) })
 }),
 http.get(`${base}/account/profile`, async ({ request }) => {
  const accountMode = localStorage.getItem('kurio:account-scenario')
  if (accountMode === 'latency') await delay(1400)
  const failure = await simulate(); if (failure) return failure
  // Credencial capturada na requisição é validada após a latência, nunca a identidade global da UI.
  return withAuthDatabase(async db => {
   const result = await current(db, request)
   if (result.failure) return result.failure
   if (accountMode === 'error500') return error(500, 'ACCOUNT_UNAVAILABLE', 'Serviço de conta temporariamente indisponível.')
   if (accountMode === 'unauthorized') { db.sessions.find(item => item.id === result.session!.id)!.expiresAt = Date.now(); return error(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.') }
   return HttpResponse.json({ userId: result.session!.user.id, sessionId: result.session!.id, profile: result.session!.user })
  })
 }),
]
