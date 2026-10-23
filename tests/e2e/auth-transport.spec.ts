import { test, expect } from './test-fixture'
import { login, demoPassword } from './auth-helpers'

test('MSW controla primeira carga, reload e navegação direta com um único registro', async ({ page }) => {
 const script = await page.request.get('/mockServiceWorker.js')
 expect(script.status()).toBe(200)
 expect(script.headers()['content-type']).toMatch(/javascript/)
 expect(await script.text()).toContain('INTEGRITY_CHECKSUM')
 for (const path of ['/login', '/cadastro', '/login']) {
  const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/session' && response.status() === 401)
  await page.goto(path)
  expect((await responsePromise).fromServiceWorker()).toBe(true)
  await expect(page.locator('.auth-fields')).toBeVisible()
  const state = await page.evaluate(async () => {
   const registrations = await navigator.serviceWorker.getRegistrations()
   return { count: registrations.length, active: registrations[0]?.active?.state, controller: navigator.serviceWorker.controller?.state, script: navigator.serviceWorker.controller?.scriptURL, changing: registrations.some(item => item.installing || item.waiting) }
  })
  expect(state).toMatchObject({ count: 1, active: 'activated', controller: 'activated', changing: false })
  expect(state.script).toBe(new URL('/mockServiceWorker.js', page.url()).href)
 }
 const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/session' && response.status() === 401)
 await page.reload()
 expect((await responsePromise).fromServiceWorker()).toBe(true)
})

test('cancelamento da recuperação de sessão não cancela o POST de cadastro', async ({ page }) => {
 await page.goto('/cadastro')
 const form = page.getByRole('form', { name: 'Cadastro', exact: true })
 await form.getByLabel('Nome de usuário', { exact: true }).fill('cadastro_pendente')
 await form.getByLabel('E-mail', { exact: true }).fill('pendente@kurio.test')
 await form.getByLabel('Senha', { exact: true }).fill(demoPassword)
 await form.getByLabel('Confirmar senha', { exact: true }).fill(demoPassword)
 await page.evaluate(async () => {
  const moduleUrl = '/tests/e2e/msw-session-barrier.ts'
  const { holdSessionRequest } = await import(moduleUrl)
  await holdSessionRequest()
 })
 const abortedSession = page.waitForEvent('requestfailed', request => new URL(request.url()).pathname === '/api/auth/session' && request.failure()?.errorText === 'net::ERR_ABORTED')
 const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/register')
 await form.getByRole('button', { name: /Criar conta|Criar perfil/ }).click()
 const response = await responsePromise
 expect(response.status()).toBe(201)
 expect(response.fromServiceWorker()).toBe(true)
 await abortedSession
 await page.evaluate(async () => {
  const moduleUrl = '/tests/e2e/msw-session-barrier.ts'
  const { releaseSessionRequest } = await import(moduleUrl)
  releaseSessionRequest()
 })
 await expect(page.locator('.account-content input[aria-label="E-mail"]')).toHaveValue('pendente@kurio.test')
})

// Multiple tests in one worker exercise process isolation, unlike repeat-each on a single case.
for (let index = 0; index < 4; index++) test(`upload de login após testes anteriores ${index + 1}`, async ({ page }) => {
 await login(page)
})
