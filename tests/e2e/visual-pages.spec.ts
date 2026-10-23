import { test, expect } from './test-fixture'
import { login } from './auth-helpers'
import { addNft, waitForResource } from './commerce-helpers'

const previews = [
 ['detalhe', '/nfts/emerald-ape-042'], ['carrinho', '/carrinho'], ['pagamento', '/pagamento'],
 ['confirmacao', '/confirmacao'], ['login', '/login'], ['cadastro', '/cadastro'],
 ['perfil', '/perfil'], ['carteiras', '/carteiras'],
] as const

for (const [name, path] of previews) {
 test(`prÃ©via visual: ${name}`, async ({ page }) => {
  test.setTimeout(60_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  if (name === 'perfil' || name === 'carteiras') await login(page, 'alice@kurio.test', path)
  if (name === 'pagamento' || name === 'confirmacao') await login(page)
  if (name === 'carrinho' || name === 'pagamento') {
   await addNft(page, 'emerald-ape-042', 2)
   await addNft(page, 'violet-nomad-314', 6)
   await addNft(page, 'ivory-baron-088', 9)
  }
  await page.goto(path)
  if (name === 'carrinho') await waitForResource(page, 'cart')
  await page.waitForFunction(async () => {
   if (![...document.fonts].some(face => face.family.includes('Roboto Mono'))) return false
   await Promise.all([400, 500, 700].map(weight => document.fonts.load(`${weight} 15px "Roboto Mono"`)))
   await document.fonts.ready
   return [400, 500, 700].every(weight => [...document.fonts].some(face => face.family.includes('Roboto Mono') && face.weight === String(weight) && face.status === 'loaded'))
  })
  await expect(page.locator('body')).toHaveCSS('font-family', '"Roboto Mono", monospace')
  await expect(page.locator('.preview-page')).toBeVisible()
  if (name === 'detalhe') await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  else if (name === 'login' || name === 'cadastro') await expect(page.getByRole('form', { name: name === 'login' ? 'Login' : 'Cadastro', exact: true })).toBeVisible()
  else if (name === 'perfil' || name === 'carteiras') await expect(page.getByRole('form', { name: name === 'perfil' ? 'Editar perfil' : 'Editar carteira', exact: true })).toBeVisible()
  else if (name === 'carrinho') {
   await expect(page.locator('.cart-item')).toHaveCount(3)
   await expect(page.getByTestId('cart-subtotal')).toHaveText('26.83 ETH')
   await expect(page.getByRole('link', { name: 'Conectar e finalizar' })).toBeVisible()
  }
  else if (name === 'pagamento') await expect(page.getByRole('button', { name: 'Cotar compra' })).toBeEnabled()
  if (name === 'login' || name === 'cadastro') await expect(page.locator('.auth-background .nft-card')).toHaveCount(9)
  for (const input of await page.locator('.preview-page input, .preview-page select, .preview-page textarea').all()) {
   if (name === 'perfil' || name === 'carteiras' || name === 'detalhe' || name === 'carrinho' || name === 'pagamento' && await input.evaluate(element => element.matches('select,input[type=radio]')) || (name === 'login' || name === 'cadastro') && await input.evaluate(element => !!element.closest('.auth-fields'))) await expect(input).toBeEnabled()
   else await expect(input).toBeDisabled()
  }
  // Carrega as artes reais antes das capturas, inclusive as abaixo da dobra.
  for (const image of await page.locator('.preview-page .nft-artwork img').all()) {
   if (!await image.isVisible()) continue
   await image.scrollIntoViewIfNeeded()
   await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (test.info().project.use.viewport!.width <= 800) {
   await expect(page.getByRole('navigation', { name: 'NavegaÃ§Ã£o mobile' })).toBeHidden()
  }
  if (name === 'confirmacao') {
   await expect(page.getByText('Nenhum pedido confirmado.')).toBeVisible()
   await expect(page.getByRole('button', { name: /Ver no Etherscan/ })).toBeDisabled()
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect(page).toHaveScreenshot(`${name}-viewport.png`, { animations: 'disabled', fullPage: false })
  await expect(page).toHaveScreenshot(`${name}-fullpage.png`, { animations: 'disabled', fullPage: true })
  expect(errors).toEqual([])
 })
}




