import { createRootRoute, createRoute, createRouter, redirect, useNavigate, useSearch, useParams, type SearchSchemaInput } from '@tanstack/react-router'
import { Layout } from '@/components/layout'
import { HomePage } from '@/features/catalog/home-page'
import { ProvisionalPage } from '@/routes/provisional-page'
import { NftDetailPage } from '@/features/nft/detail-preview'
import { normalizeDetailSearch } from '@/features/nft/detail-state'
import type { NftDetailSearch } from '@/types/nft-detail'
import { CartPreview } from '@/features/cart/cart-preview'
import { CheckoutPreview, ReceiptPreview } from '@/features/checkout/checkout-preview'
import { AccountPreview } from '@/features/account/account-preview'
import { AuthPreview } from '@/features/account/auth-preview'
import { normalizeCatalogParams } from '@/features/catalog/catalog-params'
import type { CatalogParams } from '@/types/catalog'
import { normalizeAuthSearch, type AuthSearch } from '@/features/account/auth-validation'
import { queryClient } from './query-client'
import { sessionOptions } from '@/services/auth'
import type { ParsedLocation } from '@tanstack/react-router'
import { FavoritesPage } from '@/features/cart/favorites-page'

async function requireSession({ location }: { location: ParsedLocation }) {
 const result = await queryClient.fetchQuery({ ...sessionOptions(), staleTime: 0 }).catch(() => {
  throw redirect({ to: '/login', search: { redirect: location.href, reason: 'unavailable' }, replace: true })
 })
 if (!result.session) throw redirect({ to: '/login', search: { redirect: location.href, reason: result.reason === 'expired' ? 'expired' : 'required' }, replace: true })
}
const root = createRootRoute({ component: Layout, notFoundComponent: () => <ProvisionalPage title="Página não encontrada" description="Este endereço não corresponde a uma página do Kurio."/> })
const home = createRoute({
 getParentRoute: () => root, path: '/', component: CatalogHomeRoute,
 validateSearch: (raw: Partial<CatalogParams> & SearchSchemaInput) => normalizeCatalogParams(raw),
 beforeLoad: ({ search, location }) => {
  const normalized = normalizeCatalogParams(search)
  const raw = new URLSearchParams(location.searchStr)
  const invalid = [...raw].some(([key, value]) => !Object.hasOwn(normalized, key) || String(normalized[key as keyof CatalogParams]) !== value) || [...raw.keys()].some(key => raw.getAll(key).length > 1)
  if (invalid) throw redirect({ to: '/', search: normalized, hash: location.hash, replace: true })
 },
})
function CatalogHomeRoute() {
 const params = normalizeCatalogParams(useSearch({ strict: false }))
 const navigate = useNavigate({ from: '/' })
 const update = (patch: Partial<CatalogParams>, options?: { replace?: boolean }) => {
  void navigate({
   to: '/', search: previous => normalizeCatalogParams({ ...previous, ...patch, page: Object.keys(patch).some(key => key !== 'page') ? 1 : patch.page ?? ('page' in previous ? previous.page : 1) }),
   replace: options?.replace, resetScroll: false,
  })
 }
 return <HomePage params={params} onParamsChange={update}/>
}
function NftDetailRoute() {
 const { nftId } = useParams({ from: '/nfts/$nftId' })
 const search = normalizeDetailSearch(useSearch({ strict: false }))
 const navigate = useNavigate({ from: '/nfts/$nftId' })
 return <NftDetailPage key={nftId} nftId={nftId} search={search} onChange={patch => {
  void navigate({ to: '/nfts/$nftId', params: { nftId }, search: previous => normalizeDetailSearch({ ...previous, ...patch }), replace: true, resetScroll: false })
 }}/>
}
function ReceiptRoute() { const search = useSearch({ strict: false }); return <ReceiptPreview orderId={'orderId' in search ? search.orderId : undefined}/> }
const pages = [
 createRoute({
  getParentRoute: () => root, path: '/nfts/$nftId', component: NftDetailRoute,
  validateSearch: (raw: Partial<NftDetailSearch> & SearchSchemaInput) => normalizeDetailSearch(raw),
  beforeLoad: ({ search, params, location }) => {
   const normalized = normalizeDetailSearch(search)
   const raw = new URLSearchParams(location.searchStr)
   if ([...raw].some(([key, value]) => !Object.hasOwn(normalized, key) || String(normalized[key as keyof NftDetailSearch]) !== value) || [...raw.keys()].some(key => raw.getAll(key).length > 1)) {
    throw redirect({ to: '/nfts/$nftId', params, search: normalized, replace: true })
   }
  },
 }),
 createRoute({ getParentRoute: () => root, path: '/carrinho', component: CartPreview }),
 createRoute({ getParentRoute: () => root, path: '/favoritos', beforeLoad: requireSession, component: FavoritesPage }),
 createRoute({ getParentRoute: () => root, path: '/pagamento', beforeLoad: requireSession, component: CheckoutPreview }),
 createRoute({ getParentRoute: () => root, path: '/confirmacao', beforeLoad: requireSession, component: ReceiptRoute, validateSearch: (raw: { orderId?: unknown } & SearchSchemaInput) => ({ orderId: typeof raw.orderId === 'string' && /^[a-f0-9-]{36}$/i.test(raw.orderId) ? raw.orderId : undefined }) }),
 createRoute({ getParentRoute: () => root, path: '/login', component: AuthPreview, validateSearch: (raw: Partial<AuthSearch> & SearchSchemaInput) => normalizeAuthSearch(raw) }),
 createRoute({ getParentRoute: () => root, path: '/cadastro', component: () => <AuthPreview signup/>, validateSearch: (raw: Partial<AuthSearch> & SearchSchemaInput) => normalizeAuthSearch(raw) }),
 createRoute({ getParentRoute: () => root, path: '/perfil', beforeLoad: requireSession, component: AccountPreview }),
 createRoute({ getParentRoute: () => root, path: '/carteiras', beforeLoad: requireSession, component: () => <AccountPreview wallets/> }),
]
export const router = createRouter({
 routeTree: root.addChildren([home, ...pages]), scrollRestoration: true,
 search: { strict: true },
 parseSearch: value => Object.fromEntries(new URLSearchParams(value)),
 stringifySearch: values => {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined) query.set(key, String(value)) })
  return query.size ? `?${query}` : ''
 },
})
declare module '@tanstack/react-router' { interface Register { router: typeof router } }

