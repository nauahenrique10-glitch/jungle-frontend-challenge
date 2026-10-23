import { test, expect } from './test-fixture'
test('base responsiva e navegação sem operações simuladas', async ({ page }) => {
 // Inclui todas as rotas, imagens lazy e capturas em quatro navegadores concorrentes.
 test.setTimeout(60_000)
 await page.goto('/')
 await page.waitForFunction(async () => {
  if (![...document.fonts].some(face => face.family.includes('Roboto Mono'))) return false
  await Promise.all([400, 500, 700].map(weight => document.fonts.load(`${weight} 15px "Roboto Mono"`)))
  await document.fonts.ready
  return [400, 500, 700].every(weight => [...document.fonts].some(face => face.family.includes('Roboto Mono') && face.weight === String(weight) && face.status === 'loaded'))
 })
 await expect(page.locator('body')).toHaveCSS('font-family', '"Roboto Mono", monospace')
 await expect(page.locator('body')).toHaveCSS('font-size', '15px')
 await expect(page.locator('body')).toHaveCSS('line-height', '15px')
 await expect(page.locator('body')).toHaveCSS('font-weight', '400')
 await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
 await expect(page.getByText('9 NFTs encontrados · Página 1 de 1')).toBeVisible()
 await expect(page.getByRole('heading', { name: 'Diário da Cunhagem' })).toBeVisible()
 await expect(page.getByRole('region', { name: 'Destaques promocionais' })).toBeVisible()
 await expect(page.getByRole('navigation', { name: 'Paginação do catálogo' }).getByRole('button')).toHaveCount(2)
 await expect(page.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
 await expect(page.locator('.nft-card').first()).toContainText('Emerald Ape #042')
 await expect(page.locator('.nft-card').first()).toContainText('1.19 ETH')
 await expect(page.locator('.nft-card').nth(7)).toContainText('Golden Frequency #071')
 await expect(page.locator('.nft-card').nth(7)).toContainText('0.59 ETH')
 for (const button of await page.locator('.pagination button').all()) await expect(button).toBeDisabled()
 const cta = page.getByRole('link', { name: 'EXPLORAR', exact: true })
 if (test.info().project.use.viewport!.width > 800) {
  await expect(cta).toHaveCSS('color', 'rgb(22, 14, 8)')
 } else {
  await expect(page.getByRole('banner')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Scanner indisponível' })).toBeDisabled()
  const hero = await page.locator('.hero').boundingBox()
  expect(hero!.height).toBeLessThanOrEqual(192)
  if (test.info().project.use.viewport!.width <= 414) {
   const search = await page.locator('.mobile-search').boundingBox()
   const firstCard = await page.locator('.nft-card').first().boundingBox()
   expect(search!.y).toBeCloseTo(40, 0)
   expect(hero!.y).toBeCloseTo(101, 0)
   expect(firstCard!.y).toBeGreaterThanOrEqual(340)
   expect(firstCard!.y).toBeLessThanOrEqual(346)
  }
 }
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
 // Percorre a página para validar também os assets com lazy loading abaixo da dobra.
 const artworkImages = page.locator('.nft-artwork img')
 await expect(artworkImages).toHaveCount(18)
 for (const image of await artworkImages.all()) {
  if (!await image.isVisible()) continue
  await image.scrollIntoViewIfNeeded()
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
 }
 await expect(page.locator('.hero-art img')).toHaveAttribute('src', '/assets/nfts/emerald-ape.png')
 const fourthCard = page.locator('.nft-card').nth(3).locator('img')
 const expectedFourth = test.info().project.use.viewport!.width <= 800 ? 'golden-beat.png' : 'sage-nomad.png'
 expect(await fourthCard.evaluate(element => (element as HTMLImageElement).currentSrc)).toContain(expectedFourth)
 await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
 await page.screenshot({ path: `test-results/home-viewport-${test.info().project.name}.png` })
 await page.screenshot({ path: `test-results/home-${test.info().project.name}.png`, fullPage: true })
 if (test.info().project.use.viewport!.width <= 800) {
  // A reserva inclui a barra, a elevação central e a safe area, inclusive no fim da página.
  const checkFooterClearance = async () => {
   await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
   const copyright = await page.locator('.copyright').boundingBox()
   const nav = await page.getByRole('navigation', { name: 'Navegação mobile' }).boundingBox()
   const scanner = await page.getByRole('button', { name: 'Scanner indisponível' }).boundingBox()
   expect(copyright!.y + copyright!.height).toBeLessThan(Math.min(nav!.y, scanner!.y - 12))
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await checkFooterClearance()
  await page.screenshot({ path: `test-results/home-footer-${test.info().project.name}.png` })
  const paddingBefore = await page.locator('body').evaluate(element => parseFloat(getComputedStyle(element).paddingBottom))
  await page.evaluate(() => document.documentElement.style.setProperty('--home-safe-bottom', '24px'))
  await expect.poll(() => page.locator('body').evaluate(element => parseFloat(getComputedStyle(element).paddingBottom))).toBe(paddingBefore + 24)
  await checkFooterClearance()
  await page.evaluate(() => document.documentElement.style.removeProperty('--home-safe-bottom'))
 }
 await page.getByRole('link', { name: 'EXPLORAR', exact: true }).click()
 await expect(page).toHaveURL(/#catalogo$/)
 for (const path of ['/nfts/exemplo', '/carrinho', '/pagamento', '/confirmacao', '/login', '/cadastro', '/perfil', '/carteiras']) {
  await page.goto(path)
  await expect(page.locator('.preview-page')).toBeVisible()
  if (path === '/nfts/exemplo') await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
  else if (path === '/carrinho') await expect(page.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeVisible()
  else if (['/login', '/cadastro', '/perfil', '/carteiras', '/pagamento', '/confirmacao'].includes(path)) await expect(page.getByRole('form', { name: path === '/cadastro' ? 'Cadastro' : 'Login', exact: true })).toBeVisible()
  else await expect(page.getByText('Prévia visual · Sem operações disponíveis. Dados não carregados.')).toBeVisible()
 }
 await page.goto('/pagina-inexistente')
 await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
})
