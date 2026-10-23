import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
export const worker = setupWorker(...handlers)

let startPromise: ReturnType<typeof worker.start> | undefined
export function startMocking() {
 return startPromise ??= worker.start({
  quiet: true,
  serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  onUnhandledRequest(request, print) {
   const api = new URL(import.meta.env.VITE_API_URL || '/api', location.origin)
   const url = new URL(request.url)
   if (url.origin === api.origin && (url.pathname === api.pathname || url.pathname.startsWith(`${api.pathname.replace(/\/$/, '')}/`))) print.error()
  },
 })
}
