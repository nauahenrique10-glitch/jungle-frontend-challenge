import { expect, type Page } from './test-fixture'
/** Await the application's actual query lifecycle, rather than treating navigation as API readiness. */
export async function waitForResource(page: Page, resource: 'cart' | 'favorites' | 'catalog' | 'nft-detail') {
 await page.waitForFunction(async resource => {
  const url = '/src/app/query-client.ts'
  const { queryClient } = await import(url)
  return queryClient.getQueryCache().getAll().some((query: { queryKey: readonly unknown[]; state: { status: string; fetchStatus: string } }) =>
   (query.queryKey[0] === resource || query.queryKey.at(-1) === resource) && query.state.status !== 'pending' && query.state.fetchStatus === 'idle')
 }, resource)
}
export async function addNft(page: Page, id = 'emerald-ape-042', quantity = 1, edition?: string) {
 await page.goto(`/nfts/${id}?quantity=${quantity}${edition ? `&edition=${edition}` : ''}`)
 await waitForResource(page, 'nft-detail')
 await waitForResource(page, 'cart')
 const button = page.getByRole('button', { name: /^COMPRAR$|^Comprar NFT$/ }).filter({ visible: true })
 await button.waitFor({ state: 'visible' })
 await expect(button).toBeEnabled()
 const confirmation = page.waitForResponse(response => new URL(response.url()).pathname === '/api/cart/items' && response.request().method() === 'POST')
 await button.click()
 expect((await confirmation).status()).toBe(200)
 await expect(page.getByRole('status')).toContainText('NFT adicionado ao carrinho.')
}
export async function openCart(page: Page) {
 await page.goto('/carrinho')
 await waitForResource(page, 'cart')
 await expect(page.locator('.functional-cart')).toHaveAttribute('aria-busy', 'false')
 await expect(page.locator('.cart-skeleton')).toHaveCount(0)
}
export async function commerceScenario(page: Page, value: string) {
 await page.evaluate(value => localStorage.setItem('kurio:commerce-scenario', value), value)
}
export async function logout(page: Page) {
 await page.goto('/perfil')
 await page.getByRole('button', { name: 'Sair', exact: true }).click()
 await expect(page.getByRole('form', { name: 'Login', exact: true })).toBeVisible()
}
