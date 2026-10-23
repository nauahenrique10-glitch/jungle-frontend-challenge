import { test, expect } from './test-fixture'
import { login } from './auth-helpers'
import { commerceScenario, waitForResource } from './commerce-helpers'

test('erro de favorito no catálogo restaura coração e mantém mensagem dentro da viewport', async ({ page }) => {
 await login(page)
 await page.goto('/')
 await waitForResource(page, 'catalog')
 await waitForResource(page, 'favorites')
 const card = page.locator('.nft-card[data-nft-id="emerald-ape-042"]')
 await card.hover()
 const button = card.getByRole('button', { name: 'Favoritar Emerald Ape #042' })
 await expect(button).toBeEnabled()
 await commerceScenario(page, 'mutation-error')
 const response = page.waitForResponse(r => r.url().endsWith('/api/favorites/emerald-ape-042') && r.request().method() === 'POST')
 await button.click()
 expect((await response).status()).toBe(500)
 const alert = card.getByRole('alert')
 await expect(alert).toContainText('Não foi possível')
 await expect(button).toHaveAttribute('aria-pressed', 'false')
 const bounds = await alert.boundingBox()
 expect(bounds!.x).toBeGreaterThanOrEqual(0)
 expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(test.info().project.use.viewport!.width)
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
 await page.screenshot({ path: `.artifacts/catalog-favorite-error-${test.info().project.name}.png` })
})
