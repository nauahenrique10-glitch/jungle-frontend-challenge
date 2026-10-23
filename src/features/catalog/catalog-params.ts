import { categoryOptions, networkOptions, type CatalogParams, type CatalogSort } from '@/types/catalog'

export const defaultCatalogParams: CatalogParams = {
 search: '', category: '', network: '', minPrice: '', maxPrice: '', sort: 'reference', page: 1, pageSize: 9,
}
const sorts: CatalogSort[] = ['reference', 'price-asc', 'price-desc', 'name-asc']
export function normalizeEth(value: unknown): string {
 if (typeof value !== 'string' && typeof value !== 'number') return ''
 const text = String(value).trim().replace(',', '.')
 if (!/^\d{1,6}(\.\d{1,18})?$/.test(text)) return ''
 const [integer, fraction = ''] = text.split('.')
 const tail = fraction.replace(/0+$/, '')
 return `${BigInt(integer)}${tail ? `.${tail}` : ''}`
}
/** Comparação exata em unidades de 10^-18 ETH, sem ponto flutuante. */
export function ethUnits(value: string): bigint {
 const [integer, fraction = ''] = value.split('.')
 return BigInt(integer) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))
}
export function normalizeCatalogParams(raw: Record<string, unknown>): CatalogParams {
 let minPrice = normalizeEth(raw.minPrice)
 let maxPrice = normalizeEth(raw.maxPrice)
 if (minPrice && maxPrice && ethUnits(minPrice) > ethUnits(maxPrice)) [minPrice, maxPrice] = [maxPrice, minPrice]
 const page = typeof raw.page === 'number' || typeof raw.page === 'string' ? Number(raw.page) : 1
 const pageSize = Number(raw.pageSize)
 return {
  search: typeof raw.search === 'string' ? raw.search.trim().slice(0, 120) : '',
  category: categoryOptions.some(([value]) => value === raw.category) ? raw.category as CatalogParams['category'] : '',
  network: networkOptions.some(([value]) => value === raw.network) ? raw.network as CatalogParams['network'] : '',
  minPrice, maxPrice,
  sort: sorts.includes(raw.sort as CatalogSort) ? raw.sort as CatalogSort : 'reference',
  page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10_000) : 1,
  pageSize: pageSize === 3 || pageSize === 6 ? pageSize : 9,
 }
}
export function sameCatalogFilters(a: CatalogParams, b: CatalogParams): boolean {
 return Object.keys(defaultCatalogParams).every(key => key === 'page' || a[key as keyof CatalogParams] === b[key as keyof CatalogParams])
}
