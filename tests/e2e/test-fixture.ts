import { test as base, expect } from '@playwright/test'

import { freemem, totalmem } from 'node:os'

/** Chromium's upload body can fail across reused contexts. Keep each test's process private. */
export const test = base.extend<{ transportDiagnostics: void }>({
 context: async ({ playwright, browserName, launchOptions, headless, channel, contextOptions, baseURL, viewport, colorScheme, reducedMotion, locale, ignoreHTTPSErrors, serviceWorkers }, use) => {
  const isolatedBrowser = await playwright[browserName].launch({ ...launchOptions, headless, channel })
  try {
   const context = await isolatedBrowser.newContext({ ...contextOptions, baseURL, viewport, colorScheme, reducedMotion, locale, ignoreHTTPSErrors, serviceWorkers })
   try { await use(context) } finally { await context.close() }
  } finally { await isolatedBrowser.close() }
 },
 transportDiagnostics: [async ({ page, context }, use, testInfo) => {
  const memoryBefore = { free: freemem(), total: totalmem() }
  expect(await context.cookies()).toEqual([])
  expect((await context.storageState({ indexedDB: true })).origins).toEqual([])
  expect(context.serviceWorkers()).toHaveLength(0)
  const events: unknown[] = []
  context.on('serviceworker', worker => worker.on('console', message => events.push({ kind: 'worker-console', text: message.text() })))
  const cdp = await context.newCDPSession(page)
  const urls = new Map<string, string>()
  await cdp.send('Network.enable')
  await cdp.send('Log.enable')
  await cdp.send('ServiceWorker.enable')
  cdp.on('ServiceWorker.workerErrorReported', event => events.push({ kind: 'worker-error', ...event.errorMessage }))
  cdp.on('Network.requestWillBeSent', event => { urls.set(event.requestId, event.request.url) })
  cdp.on('Network.loadingFailed', event => { events.push({ kind: 'transport', url: urls.get(event.requestId), error: event.errorText, canceled: event.canceled, blockedReason: event.blockedReason, corsErrorStatus: event.corsErrorStatus }) })
  cdp.on('Log.entryAdded', ({ entry }) => { if (entry.level === 'error' || entry.level === 'warning') events.push({ kind: 'browser-log', source: entry.source, text: entry.text, url: entry.url }) })
  page.on('pageerror', error => events.push({ kind: 'page-error', message: error.message }))
  await use()
  if (testInfo.status !== testInfo.expectedStatus) {
   const application = await page.evaluate(async () => {
    const url = '/src/app/query-client.ts'
    const { queryClient } = await import(url)
    return {
     online: navigator.onLine,
     queries: queryClient.getQueryCache().getAll().map((query: { queryKey: readonly unknown[]; state: { status: string; fetchStatus: string } }) => ({ key: query.queryKey, status: query.state.status, fetchStatus: query.state.fetchStatus })),
     mutations: queryClient.getMutationCache().getAll().map((mutation: { options: { mutationKey?: readonly unknown[] }; state: { status: string; isPaused: boolean; submittedAt: number } }) => ({ key: mutation.options.mutationKey, status: mutation.state.status, paused: mutation.state.isPaused, ageMs: Date.now() - mutation.state.submittedAt })),
    }
   }).catch(() => null)
   const workers = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(registration => ({ scope: registration.scope, active: registration.active?.state, installing: registration.installing?.state, waiting: registration.waiting?.state, script: registration.active?.scriptURL }))).catch(() => [])
   await testInfo.attach('transport-diagnostics', { body: JSON.stringify({ events, workers, application, memoryBefore, memoryAfter: { free: freemem(), total: totalmem() } }, null, 2), contentType: 'application/json' })
  }
 }, { auto: true }],
})
export { expect }
export type { Page } from '@playwright/test'
