import { test, expect, type Page } from './test-fixture'
import { normalizeQuantity } from '../../src/features/nft/detail-state'

const emerald = '/nfts/emerald-ape-042'
async function loaded(page: Page, name = 'Emerald Ape #042') {
 await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible()
 await expect(page.locator('.functional-detail')).toHaveAttribute('aria-busy', 'false')
}
async function scenario(page: Page, value: string) {
 await page.addInitScript(value => { if (!localStorage.getItem('kurio:detail-scenario')) localStorage.setItem('kurio:detail-scenario', value) }, value)
}
const params = (page: Page) => new URL(page.url()).searchParams

test('card abre o NFT correto, histórico e retorno preservam todo o contexto do catálogo', async ({ page }) => {
 await page.goto('/?search=o&category=&network=&minPrice=0.39&maxPrice=1.99&sort=price-asc&page=2&pageSize=3')
 await expect(page.locator('.catalog-results .nft-card[data-nft-id]')).toHaveCount(3)
 const original = new URL(page.url()).searchParams
 const card = page.locator('.catalog-results .nft-card[data-nft-id]').first()
 const id = await card.getAttribute('data-nft-id')
 const name = await card.locator('h3').innerText()
 await card.getByRole('link', { name: `Ver detalhes de ${name}`, exact: true }).click()
 await loaded(page, name)
 expect(new URL(page.url()).pathname).toBe(`/nfts/${id}`)
 for (const key of ['search', 'category', 'network', 'minPrice', 'maxPrice', 'sort', 'page', 'pageSize']) expect(params(page).get(key)).toBe(original.get(key))
 await page.goBack()
 await expect(page.locator('.catalog-results .nft-card')).toHaveCount(3)
 expect(params(page).get('page')).toBe('2')
 expect(params(page).get('search')).toBe('o')
 await page.goForward()
 await loaded(page, name)
 await page.reload()
 await loaded(page, name)
 await page.getByRole('link', { name: 'Voltar ao catálogo', exact: true }).click()
 await expect(page.locator('.catalog-results .nft-card')).toHaveCount(3)
 for (const [key, value] of original) expect(params(page).get(key)).toBe(value)
})

test('acesso direto passa por HTTP/MSW e carrega metadados confirmados', async ({ page }) => {
 const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/nfts/emerald-ape-042')
 await page.goto(emerald)
 const response = await responsePromise
 expect(response.fromServiceWorker()).toBe(true)
 expect(response.status()).toBe(200)
 const body = await response.json()
 expect(body.availableQuantity).toBeNull()
 expect(body.gallery).toEqual(['emerald'])
 expect(body.tokenId).toBe('#0042')
 expect(body.network).toBe('ethereum')
 expect(body.priceEth).toBe('1.19')
 await loaded(page)
 await expect(page.locator('.detail-metadata')).toContainText('Kurio Apes')
 await expect(page.locator('.detail-metadata')).toContainText('Óculos, Esmeralda, Raro')
 await expect(page.locator('.detail-main-art img')).toHaveAttribute('src', '/assets/nfts/emerald-ape.png')
 await page.reload()
 await loaded(page)
 await expect(page.locator('.detail-metadata')).toContainText('#0042')
})

test('edições e quantidade selecionadas persistem na URL e no refresh', async ({ page }) => {
 await page.goto(emerald)
 await loaded(page)
 const editions = page.getByRole('group', { name: 'Edição do NFT', exact: true })
 await expect(editions.getByRole('button', { name: '1/50', exact: true })).toHaveAttribute('aria-pressed', 'true')
 for (const [label, id] of [['1/1', '1-1'], ['1/10', '1-10'], ['ABERTA', 'open'], ['1/50', '1-50']]) {
  await editions.getByRole('button', { name: label, exact: true }).click()
  await expect(editions.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(params(page).get('edition')).toBe(id)
 }
 await page.getByRole('button', { name: 'Aumentar quantidade', exact: true }).click()
 await expect(page.getByRole('spinbutton', { name: 'Quantidade', exact: true })).toHaveValue('2')
 expect(params(page).get('quantity')).toBe('2')
 await page.reload()
 await loaded(page)
 await expect(editions.getByRole('button', { name: '1/50', exact: true })).toHaveAttribute('aria-pressed', 'true')
 await expect(page.getByRole('spinbutton', { name: 'Quantidade', exact: true })).toHaveValue('2')
})

test('quantidade aceita apenas inteiros positivos, suporta teclado e não deriva estoque da edição', async ({ page }) => {
 await page.goto(emerald)
 await loaded(page)
 const quantity = page.getByRole('spinbutton', { name: 'Quantidade', exact: true })
 const minus = page.getByRole('button', { name: 'Diminuir quantidade', exact: true })
 await expect(minus).toBeDisabled()
 for (const invalid of ['0', '-1', '1.5', 'abc', '9007199254740992', '']) {
  await quantity.fill(invalid)
  await quantity.blur()
  await expect(quantity).toHaveValue('1')
 }
 await page.getByRole('button', { name: 'Aumentar quantidade', exact: true }).click()
 await expect(quantity).toHaveValue('2')
 await minus.click()
 await expect(quantity).toHaveValue('1')
 await expect(minus).toBeDisabled()
 await quantity.fill('51')
 await expect(quantity).toHaveValue('51')
 await quantity.press('ArrowDown')
 await expect(quantity).toHaveValue('50')
 await quantity.press('ArrowUp')
 await expect(quantity).toHaveValue('51')
 // Suporte a estoque futuro validado sem fabricar estoque nas fixtures.
 expect(normalizeQuantity(8, 5)).toBe(5)
 expect(normalizeQuantity(-1, 5)).toBe(1)
 expect(normalizeQuantity('2.5', 5)).toBe(1)
})

test('metadados ausentes não são derivados do nome e edição inválida é descartada', async ({ page }) => {
 await page.goto('/nfts/sage-nomad-009?edition=1-50&quantity=-5')
 await loaded(page, 'Sage Nomad #009')
 await expect(page.getByRole('group', { name: 'Edição do NFT' }).getByRole('button', { name: 'Não informada' })).toBeDisabled()
 await expect(page.locator('.detail-metadata')).toContainText('Não informado')
 await expect(page.locator('.detail-metadata')).not.toContainText('#0009')
 await expect(page.getByRole('spinbutton', { name: 'Quantidade' })).toHaveValue('1')
 await expect.poll(() => params(page).get('edition')).toBe('')
 await page.goto(`${emerald}?edition=falsa&quantity=1.5`)
 await loaded(page)
 await expect.poll(() => params(page).get('edition')).toBe('1-50')
 await expect(page.getByRole('spinbutton', { name: 'Quantidade' })).toHaveValue('1')
})

test('NFT inexistente retorna 404 sem retry e oferece retorno ao catálogo', async ({ page }) => {
 let attempts = 0
 page.on('response', response => { if (new URL(response.url()).pathname === '/api/nfts/inexistente') attempts++ })
 const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/nfts/inexistente')
 await page.goto('/nfts/inexistente?search=Golden&pageSize=3')
 expect((await responsePromise).status()).toBe(404)
 await expect(page.getByRole('heading', { name: 'NFT não encontrado', exact: true })).toBeVisible()
 expect(attempts).toBe(1)
 await expect(page.getByRole('button', { name: 'Tentar novamente' })).toHaveCount(0)
 await page.locator('.detail-feedback').getByRole('link', { name: 'Explorar catálogo', exact: true }).click()
 await expect(page.locator('.catalog-results .nft-card')).toHaveCount(3)
 expect(params(page).get('search')).toBe('Golden')
})

test('erro 500 tem retry automático limitado e recuperação manual via MSW', async ({ page }) => {
 await scenario(page, 'error500')
 let attempts = 0
 page.on('response', response => { if (new URL(response.url()).pathname === '/api/nfts/emerald-ape-042') attempts++ })
 await page.goto(emerald)
 await expect(page.getByRole('alert')).toContainText('Não foi possível carregar o NFT')
 expect(attempts).toBe(2)
 await page.evaluate(() => localStorage.setItem('kurio:detail-scenario', 'success'))
 await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
 await loaded(page)
 expect(attempts).toBe(3)
})

test('skeleton preserva galeria e painel nas quatro larguras', async ({ page }) => {
 await scenario(page, 'latency')
 await page.goto(emerald)
 await expect(page.getByRole('status')).toHaveText('Carregando NFT…')
 const artBefore = await page.locator('.detail-skeleton .detail-main-art').boundingBox()
 const infoBefore = await page.locator('.detail-skeleton .detail-information').boundingBox()
 await page.emulateMedia({ reducedMotion: 'reduce' })
 await expect(page.locator('.catalog-shimmer').first()).toHaveCSS('animation-name', 'none')
 await loaded(page)
 const artAfter = await page.locator('.detail-main-art').boundingBox()
 const infoAfter = await page.locator('.detail-information').boundingBox()
 for (const key of ['x', 'y', 'width', 'height'] as const) expect(artAfter![key]).toBeCloseTo(artBefore![key], 0)
 expect(infoAfter!.width).toBeCloseTo(infoBefore!.width, 0)
 expect(infoAfter!.height).toBeCloseTo(infoBefore!.height, 0)
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('ações fora do escopo permanecem desabilitadas e galeria informa imagem única', async ({ page }) => {
 await page.goto(emerald)
 await loaded(page)
 for (const button of await page.getByRole('button', { name: /^COMPRAR$|^Comprar NFT$|Favoritar|Adicionar ao carrinho/ }).all()) {
  if (await button.isVisible()) await expect(button).toBeEnabled()
 }
 await expect(page.getByRole('button', { name: 'Compartilhamento indisponível', includeHidden: true })).toBeDisabled()
 await expect(page.locator('.detail-thumbnails button:disabled')).toHaveCount(3)
 await expect(page.locator('.detail-thumbnails button[aria-pressed="true"]')).toHaveCount(1)
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
