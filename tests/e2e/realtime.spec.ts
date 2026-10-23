import { test, expect, type Page } from './test-fixture'
import { login } from './auth-helpers'
import { addNft, openCart, logout } from './commerce-helpers'
import { api, confirmed, quoteAndConnect, scenario, setupCheckout } from './checkout-helpers'

test.setTimeout(90_000)
async function connected(page: Page) { await expect(page.locator('main#main')).toBeAttached(); await expect.poll(() => page.evaluate(async () => { const path = '/src/services/realtime.ts'; return (await import(path)).realtimeSnapshot().status })).toBe('connected') }
async function drive(page: Page, method: string, args: unknown[] = []) {
 return page.evaluate(async ({ method, args }) => { const path = '/src/services/http.ts'; const { http } = await import(path); return (await http.post('/__scenarios/realtime', { command: method, args })).data }, { method, args })
}
async function diagnostic(page: Page) { return page.evaluate(async () => { const path = '/src/services/realtime.ts'; return (await import(path)).realtimeDiagnostics() }) }
async function pending(page: Page) {
 await setupCheckout(page)
 await connected(page)
 await quoteAndConnect(page)
 await scenario(page, 'pending')
 await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
 await expect(page.getByRole('heading', { name: 'Pagamento pendente', exact: true })).toBeVisible()
 await connected(page)
 await expect.poll(() => page.evaluate(async id => {
  const path = '/src/app/query-client.ts'; const { queryClient } = await import(path)
  return queryClient.getQueryCache().getAll().find((query: { queryKey: unknown[] }) => query.queryKey[4] === 'order' && query.queryKey.at(-1) === id)?.state.fetchStatus
 }, new URL(page.url()).searchParams.get('orderId'))).toBe('idle')
 return new URL(page.url()).searchParams.get('orderId')!
}

test('Socket.IO conecta pela camada MSW e mantém um listener por evento ao navegar', async ({ page }) => {
 await page.goto('/')
 await connected(page)
 expect(await drive(page, 'diagnostics')).toMatchObject({ connections: 1, subscriptions: 1 })
 for (const destination of ['/carrinho', '/nfts/emerald-ape-042', '/']) {
  await page.evaluate(async destination => { const path = '/src/app/router.tsx'; await (await import(path)).router.navigate({ to: destination }) }, destination)
  await connected(page)
  expect(await diagnostic(page)).toMatchObject({ nftListeners: 1, orderListeners: 1 })
  expect(await drive(page, 'diagnostics')).toMatchObject({ connections: 1, subscriptions: 1 })
 }
})

test('nft.updated atualiza catálogo, detalhe e carrinho usando o mesmo estado REST', async ({ page }) => {
 await addNft(page)
 await page.goto('/')
 await connected(page)
 const card = page.locator('.catalog-results .nft-card[data-nft-id="emerald-ape-042"]')
 await drive(page, 'nft', ['emerald-ape-042', '1.29'])
 await expect(card).toContainText('1.29 ETH')
 await page.goto('/nfts/emerald-ape-042')
 await connected(page)
 await drive(page, 'nft', ['emerald-ape-042', '1.39'])
 await expect(page.locator('.detail-price')).toContainText('1.39 ETH')
 await openCart(page)
 await expect(page.getByTestId('cart-subtotal')).toHaveText('1.39 ETH')
})

test('preço em tempo real invalida checkout e exige cotação e confirmação novas', async ({ page }) => {
 await setupCheckout(page)
 await connected(page)
 await quoteAndConnect(page)
 await drive(page, 'nft', ['emerald-ape-042', '1.29'])
 await expect(page.getByRole('button', { name: 'Confirmar compra', exact: true })).toBeDisabled()
 await expect(page.getByRole('alert')).toContainText('Atualize a cotação')
 expect((await api(page, 'orders')).data.orders).toHaveLength(0)
 await page.getByRole('button', { name: 'Atualizar cotação', exact: true }).click()
 await expect(page.getByTestId('quote-total')).toHaveText('2.596 ETH')
 await expect(page.getByRole('button', { name: 'Confirmar compra', exact: true })).toBeEnabled()
 expect((await api(page, 'orders')).data.orders).toHaveLength(0)
 await page.getByRole('button', { name: 'Confirmar compra', exact: true }).click()
 await confirmed(page)
})

for (const delivery of ['duplicate', 'old', 'out-of-order']) {
 test(`nft.updated ${delivery} não regride versões nem reaplica invalidação`, async ({ page }) => {
  await page.goto('/')
  await connected(page)
  const before = await diagnostic(page)
  await drive(page, 'nft', ['emerald-ape-042', '1.49', delivery])
  await expect(page.locator('.catalog-results .nft-card[data-nft-id="emerald-ape-042"]')).toContainText('1.49 ETH')
  expect((await diagnostic(page)).acceptedNfts - before.acceptedNfts).toBe(1)
  expect((await diagnostic(page)).ignored).toBeGreaterThan(before.ignored)
 })
}

for (const outcome of ['confirmed', 'refused']) {
 test(`order.updated ${outcome} chega pelo socket e respeita o carrinho`, async ({ page }) => {
  const id = await pending(page)
  const before = await diagnostic(page)
  const gets: number[] = []
  page.on('request', request => { if (request.method() === 'GET' && new URL(request.url()).pathname === `/api/orders/${id}`) gets.push(1) })
  await drive(page, 'order', [id, outcome])
  await expect(page.getByRole('heading', { name: outcome === 'confirmed' ? 'Seus NFTs agora estão na sua carteira' : 'Pagamento recusado', exact: true })).toBeVisible()
  expect((await diagnostic(page)).acceptedOrders).toBe(before.acceptedOrders + 1)
  expect(gets).toHaveLength(0) // Socket is primary: no polling round-trip produced the transition.
  expect((await api(page, 'cart')).data.items.length).toBe(outcome === 'confirmed' ? 0 : 1)
 })
}

test('pedido duplicado/antigo não reabre recibo nem remove acréscimos do carrinho', async ({ page }) => {
 const id = await pending(page)
 await addNft(page, 'emerald-ape-042', 3)
 await page.goto(`/confirmacao?orderId=${id}`)
 await connected(page)
 await expect(page.getByRole('heading', { name: 'Pagamento pendente', exact: true })).toBeVisible()
 await drive(page, 'order', [id, 'confirmed', 'duplicate'])
 await confirmed(page)
 const version = (await api(page, 'cart')).data.version
 await drive(page, 'order', [id, 'refused', 'old'])
 await confirmed(page)
 const cart = (await api(page, 'cart')).data
 expect(cart.items[0].quantity).toBe(3)
 expect(cart.version).toBe(version)
})

test('perda de evento desconectado converge para REST ao reconectar', async ({ page }) => {
 const id = await pending(page)
 await page.evaluate(() => localStorage.setItem('kurio:realtime-scenario', 'disconnected'))
 await drive(page, 'disconnect')
 await expect.poll(() => page.evaluate(async () => { const path = '/src/services/realtime.ts'; return (await import(path)).realtimeSnapshot().status })).not.toBe('connected')
 await drive(page, 'nft', ['emerald-ape-042', '1.59', 'lost'])
 await drive(page, 'order', [id, 'confirmed', 'lost'])
 const before = (await diagnostic(page)).reconciliations
 await page.evaluate(() => localStorage.setItem('kurio:realtime-scenario', 'success'))
 await connected(page)
 await confirmed(page)
 expect((await diagnostic(page)).reconciliations).toBeGreaterThan(before)
 expect((await api(page, 'cart')).data.items).toHaveLength(0)
 await page.goto('/nfts/emerald-ape-042')
 await expect(page.locator('.detail-price')).toContainText('1.59 ETH')
})

test('refresh de pending refaz subscriptions sem multiplicar listeners', async ({ page }) => {
 const id = await pending(page)
 await page.reload()
 await connected(page)
 await expect(page.getByRole('heading', { name: 'Pagamento pendente', exact: true })).toBeVisible()
 expect(await drive(page, 'diagnostics')).toMatchObject({ connections: 1, subscriptions: 1 })
 await drive(page, 'order', [id, 'confirmed'])
 await confirmed(page)
})

test('logout, troca de usuário e evento privado estrangeiro não vazam pedido', async ({ page }) => {
 const id = await pending(page)
 await drive(page, 'order', [id, 'confirmed', 'foreign'])
 await expect(page.getByRole('heading', { name: 'Pagamento pendente', exact: true })).toBeVisible()
 expect((await diagnostic(page)).acceptedOrders).toBe(0)
 await logout(page)
 await connected(page)
 expect((await drive(page, 'diagnostics')).users).toEqual([null])
 await login(page, 'bruno@kurio.test')
 await connected(page)
 expect((await drive(page, 'diagnostics')).users).toEqual(['user-bruno'])
 const before = (await diagnostic(page)).acceptedOrders
 await drive(page, 'order', [id, 'confirmed'])
 expect((await diagnostic(page)).acceptedOrders).toBe(before)
 await page.goto(`/confirmacao?orderId=${id}`)
 await expect(page.getByText('Pedido não encontrado para este usuário.', { exact: true })).toBeVisible()
})

test('falha de conexão preserva REST e permite reconexão', async ({ page }) => {
 await page.addInitScript(() => localStorage.setItem('kurio:realtime-scenario', 'connection-error'))
 await page.goto('/nfts/emerald-ape-042')
 await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
 await page.evaluate(() => localStorage.setItem('kurio:realtime-scenario', 'success'))
 await connected(page)
 expect(await drive(page, 'diagnostics')).toMatchObject({ connections: 1, subscriptions: 1 })
})

test('evento com sessão antiga do mesmo usuário é descartado', async ({ page }) => {
 const id = await pending(page)
 const before = await diagnostic(page)
 await drive(page, 'order', [id, 'confirmed', 'old-session'])
 await expect(page.getByRole('heading', { name: 'Pagamento pendente', exact: true })).toBeVisible()
 expect((await diagnostic(page)).acceptedOrders).toBe(before.acceptedOrders)
 expect((await diagnostic(page)).ignored).toBeGreaterThan(before.ignored)
})

test('expiração recebida pelo socket encerra sessão e subscriptions privadas', async ({ page }) => {
 await pending(page)
 await page.evaluate(() => localStorage.setItem('kurio:auth-scenario', 'expired'))
 // No REST action is issued: the server's session validation sends session.expired.
 await expect(page.getByRole('form', { name: 'Login', exact: true })).toBeVisible()
 expect(new URL(page.url()).searchParams.get('reason')).toBe('expired')
 await connected(page)
 expect((await drive(page, 'diagnostics')).users).toEqual([null])
 expect(await page.evaluate(async () => { const path = '/src/app/query-client.ts'; return (await import(path)).queryClient.getQueryCache().getAll().some((query: { queryKey: unknown[] }) => query.queryKey[0] === 'private') })).toBe(false)
})
