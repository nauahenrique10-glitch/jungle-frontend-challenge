// Browser-only test helper, loaded through Vite. Never imported by the application.
import { http, HttpResponse } from 'msw'
import { worker } from '../../src/services/mocks/browser'
import { queryClient } from '../../src/app/query-client'
import { sessionKey, sessionOptions } from '../../src/services/auth'

let release: (() => void) | undefined
export async function holdSessionRequest() {
 await queryClient.cancelQueries({ queryKey: sessionKey, exact: true })
 let started!: () => void
 const requestStarted = new Promise<void>(resolve => { started = resolve })
 const barrier = new Promise<void>(resolve => { release = resolve })
 worker.use(http.get('/api/auth/session', async () => {
  started()
  await barrier
  return HttpResponse.json({ code: 'SESSION_REQUIRED', message: 'Entre para continuar.' }, { status: 401 })
 }, { once: true }))
 void queryClient.fetchQuery({ ...sessionOptions(), staleTime: 0 }).catch(() => undefined)
 await requestStarted
}
export function releaseSessionRequest() {
 worker.resetHandlers()
 release?.()
 release = undefined
}
