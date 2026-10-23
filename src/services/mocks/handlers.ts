import { delay, http, HttpResponse } from 'msw'
import { catalogFixtures } from './catalog-fixtures'
import { findNftDetail } from './nft-detail-fixtures'
import { authHandlers } from './auth-handlers'
import { accountHandlers } from './account-handlers'
import { commerceHandlers } from './commerce-handlers'
import { checkoutHandlers } from './checkout-handlers'
import { realtimeHandlers } from './realtime-handlers'
import { withAuthDatabase } from './auth-store'
import { marketNft } from './market-store'
import { ethUnits, normalizeCatalogParams } from '@/features/catalog/catalog-params'
import { categoryOptions, networkOptions, type CatalogResponse } from '@/types/catalog'

export const catalogScenarios = ['success', 'empty', 'latency', 'error500', 'out-of-order'] as const
export type CatalogScenario = typeof catalogScenarios[number]
function getScenario(): CatalogScenario {
 let configured: unknown = import.meta.env.VITE_CATALOG_SCENARIO || 'success'
 try { configured = localStorage.getItem('kurio:catalog-scenario') || configured } catch { /* Storage pode estar bloqueado. */ }
 return catalogScenarios.includes(configured as CatalogScenario) ? configured as CatalogScenario : 'success'
}
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
const comparePrice = (a: string, b: string) => ethUnits(a) < ethUnits(b) ? -1 : ethUnits(a) > ethUnits(b) ? 1 : 0
const baseURL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export const handlers = [
 ...authHandlers,
 ...accountHandlers,
 ...commerceHandlers,
 ...checkoutHandlers,
 ...realtimeHandlers,
 http.get(`${baseURL}/nfts/:id`, async ({ params }) => {
  let scenario = import.meta.env.VITE_DETAIL_SCENARIO || 'success'
  try { scenario = localStorage.getItem('kurio:detail-scenario') || scenario } catch { /* Storage opcional. */ }
  await delay(scenario === 'latency' ? 1400 : 100)
  if (scenario === 'error500') return HttpResponse.json({ code: 'NFT_UNAVAILABLE', message: 'Não foi possível consultar o NFT.' }, { status: 500 })
  const nft = await withAuthDatabase(db => scenario === 'not-found' ? undefined : findNftDetail(String(params.id), db))
  return nft ? HttpResponse.json(nft) : HttpResponse.json({ code: 'NFT_NOT_FOUND', message: 'NFT não encontrado.' }, { status: 404 })
 }),
 http.get(`${baseURL}/nfts`, async ({ request }) => {
  const params = normalizeCatalogParams(Object.fromEntries(new URL(request.url).searchParams))
  const scenario = getScenario()
  await delay(scenario === 'latency' ? 1400 : scenario === 'out-of-order' ? (params.search.toLowerCase().includes('emerald') ? 1200 : 100) : 100)
  if (scenario === 'error500') return HttpResponse.json({ code: 'CATALOG_UNAVAILABLE', message: 'Catálogo temporariamente indisponível.' }, { status: 500 })

  const currentItems = await withAuthDatabase(db => catalogFixtures.map(nft => marketNft(db, nft)))
  let items = currentItems.filter(nft =>
   (!params.search || fold(nft.name).includes(fold(params.search))) &&
   (!params.category || nft.category === params.category) &&
   (!params.network || nft.network === params.network) &&
   (!params.minPrice || comparePrice(nft.priceEth, params.minPrice) >= 0) &&
   (!params.maxPrice || comparePrice(nft.priceEth, params.maxPrice) <= 0),
  )
  if (scenario === 'empty') items = []
  if (params.sort === 'price-asc') items.sort((a, b) => comparePrice(a.priceEth, b.priceEth))
  if (params.sort === 'price-desc') items.sort((a, b) => comparePrice(b.priceEth, a.priceEth))
  if (params.sort === 'name-asc') items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const total = items.length
  const totalPages = Math.ceil(total / params.pageSize)
  const page = Math.min(params.page, Math.max(1, totalPages))
  const body: CatalogResponse = {
   items: items.slice((page - 1) * params.pageSize, page * params.pageSize), total, page, pageSize: params.pageSize, totalPages,
   facets: {
    categories: categoryOptions.map(([value, label]) => ({ value, label, count: catalogFixtures.filter(nft => nft.category === value).length })),
    networks: networkOptions.map(([value, label]) => ({ value, label, count: catalogFixtures.filter(nft => nft.network === value).length })),
   },
  }
  return HttpResponse.json(body)
 }),
]
