import { expect, type Page } from '@playwright/test'
export const demoPassword = 'KurioDemo!2026'
export async function login(page: Page, email = 'alice@kurio.test', destination?: string) {
 await page.goto(`/login${destination ? `?redirect=${encodeURIComponent(destination)}` : ''}`)
 const form = page.getByRole('form', { name: 'Login', exact: true })
 await form.getByLabel('E-mail', { exact: true }).fill(email)
 await form.getByLabel('Senha', { exact: true }).fill(demoPassword)
 const authenticated = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/login')
 const profileLoaded = page.waitForResponse(async response => {
  if (new URL(response.url()).pathname !== '/api/account/profile' || response.status() !== 200) return false
  const [profile, auth] = await Promise.all([response.json(), authenticated.then(result => result.json())])
  return profile.sessionId === auth.session?.id
 })
 await form.getByRole('button', { name: 'Entrar', exact: true }).click()
 expect((await authenticated).status()).toBe(200)
 const profile = await (await profileLoaded).json()
 expect(profile.profile.email).toBe(email)
 await expect(page.locator('.account-content input[aria-label="E-mail"]')).toHaveValue(email)
}
export async function setAuthScenario(page: Page, value: string) {
 await page.addInitScript(value => { if (!localStorage.getItem('kurio:auth-scenario')) localStorage.setItem('kurio:auth-scenario', value) }, value)
}
