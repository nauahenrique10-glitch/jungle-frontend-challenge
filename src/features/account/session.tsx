import { useEffect } from 'react'
import { Navigate, useRouterState } from '@tanstack/react-router'
import { useIsMutating, useMutation, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryClient } from '@/app/query-client'
import { authTokenKey, getPrivateProfile, logout, privateKeys, sessionKey, sessionOptions, synchronizeExternalSession } from '@/services/auth'
import type { AuthSession } from '@/types/auth'
import { Button } from '@/components/ui/button'

export const isProtectedPath = (path: string) => ['/perfil', '/carteiras', '/favoritos', '/pagamento', '/confirmacao'].includes(path.replace(/\/+$/, ''))
export const useSession = () => useQuery(sessionOptions())
export function usePrivateProfile(session: AuthSession) {
 return useQuery({ queryKey: privateKeys.resource(session, 'profile'), queryFn: ({ signal }) => getPrivateProfile(session, signal), retry: false, staleTime: 15_000, gcTime: 0 })
}
export function useLogout() {
 return useMutation({ mutationKey: ['auth', 'logout'], mutationFn: logout, retry: false, gcTime: 0, meta: { sensitive: true } })
}
export function SessionGate({ children }: { children: ReactNode }) {
 const query = useSession()
 const location = useRouterState({ select: state => state.location })
 const busy = useIsMutating({ mutationKey: ['auth'] }) > 0
 useEffect(() => {
  const focus = () => { if (!busy) void queryClient.invalidateQueries({ queryKey: sessionKey, exact: true }) }
  const storage = (event: StorageEvent) => { if (event.key === authTokenKey || event.key === null) synchronizeExternalSession() }
  window.addEventListener('focus', focus)
  window.addEventListener('storage', storage)
  return () => { window.removeEventListener('focus', focus); window.removeEventListener('storage', storage) }
 }, [busy])
 useEffect(() => {
  if (!query.data?.session || busy) return
  const remaining = Date.parse(query.data.session.expiresAt) - Date.now()
  const timeout = window.setTimeout(() => { void queryClient.invalidateQueries({ queryKey: sessionKey, exact: true }) }, Math.max(0, remaining) + 20)
  return () => window.clearTimeout(timeout)
 }, [query.data?.session?.id, query.data?.session?.expiresAt, busy])
 if (!isProtectedPath(location.pathname)) return children
 if (query.isPending) return <div className="preview-page session-feedback" role="status">Recuperando sessão…</div>
 if (query.isError) return <div className="preview-page session-feedback" role="alert"><h1>Não foi possível verificar a sessão</h1><Button onClick={() => void query.refetch()}>Tentar novamente</Button></div>
 if (!query.data.session) return <Navigate to="/login" search={{ redirect: location.href, reason: query.data.reason === 'expired' ? 'expired' : 'required' }} replace/>
 return children
}
