// Test-only deterministic response barrier; the real handler commits before release.
import { getResponse, http } from 'msw'
import { worker } from '../../src/services/mocks/browser'
import { commerceHandlers } from '../../src/services/mocks/commerce-handlers'
let release: (() => void) | undefined
let started: Promise<void>
export function holdCommerceResponse(path: string) {
 let acknowledge!: () => void
 started = new Promise(resolve => { acknowledge = resolve })
 const barrier = new Promise<void>(resolve => { release = resolve })
 worker.use(http.post(path, async ({ request }) => {
  const response = await getResponse(commerceHandlers, request)
  acknowledge()
  await barrier
  return response!
 }, { once: true }))
}
export const waitForCommerceCommit = () => started
export function releaseCommerceResponse() { release?.(); release = undefined; worker.resetHandlers() }
