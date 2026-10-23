import { test, expect } from '../e2e/test-fixture'

test('build estático usa Socket.IO/MSW e reconcilia catálogo e detalhe sem backend', async ({ page }) => {
 await page.goto('/')
 await expect(page.locator('.catalog-results .nft-card')).toHaveCount(9)
 // Scenario driver is test-only. All application data still goes through Axios and MSW.
 const command = (name: string, args: unknown[] = []) => page.evaluate(async ({ name, args }) => {
  const response = await fetch('/api/__scenarios/realtime', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: name, args }) })
  if (!response.ok) throw new Error(`Mock control: ${response.status}`)
  return response.json()
 }, { name, args })
 await expect.poll(async () => (await command('diagnostics')).subscriptions).toBe(1)
 await command('nft', ['emerald-ape-042', '1.29'])
 const card = page.locator('.catalog-results .nft-card[data-nft-id="emerald-ape-042"]')
 await expect(card).toContainText('1.29 ETH')
 await card.getByRole('link', { name: 'Ver detalhes de Emerald Ape #042', exact: true }).click()
 await expect(page.getByRole('heading', { name: 'Emerald Ape #042', exact: true })).toBeVisible()
 await command('nft', ['emerald-ape-042', '1.49'])
 await expect(page.locator('.detail-price')).toContainText('1.49 ETH')
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
