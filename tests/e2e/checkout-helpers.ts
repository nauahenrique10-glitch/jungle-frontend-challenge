import { expect, type Page } from './test-fixture'
import { login } from './auth-helpers'
import { addNft } from './commerce-helpers'

export async function scenario(page: Page, name: string) { await page.evaluate(name => localStorage.setItem('kurio:checkout-scenario', name), name) }
export async function setupCheckout(page: Page, quantity = 2) {
 await login(page)
 await addNft(page, 'emerald-ape-042', quantity)
 await page.goto('/pagamento')
 await expect(page.getByRole('button', { name: 'Cotar compra', exact: true })).toBeEnabled()
}
export async function quoteAndConnect(page: Page) {
 await page.getByRole('button', { name: 'Cotar compra', exact: true }).click()
 await expect(page.getByTestId('quote-total')).not.toHaveText('A cotar')
 await page.getByRole('button', { name: 'Conectar carteira simulada', exact: true }).click()
 await expect(page.getByRole('button', { name: 'Desconectar carteira', exact: true })).toBeEnabled()
 await expect(page.getByRole('button', { name: 'Confirmar compra', exact: true })).toBeEnabled()
}
export async function confirmed(page: Page) { await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira', exact: true })).toBeVisible() }
/** Test driver still goes through the production Axios/session client and the actual MSW handlers. */
export async function api(page: Page, operation: string, body?: unknown) {
 return page.evaluate(async ({ operation, body }) => {
  const driver = '/tests/e2e/checkout-api.ts'
  return (await import(driver)).run(operation, body)
 }, { operation, body })
}
