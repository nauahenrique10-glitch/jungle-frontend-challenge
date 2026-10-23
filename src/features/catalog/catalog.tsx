import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { ChevronRight, Heart, Search, SlidersHorizontal, X } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { NftArtwork, type NftArtworkKey } from '@/components/nft-artwork'
import { Button } from '@/components/ui/button'
import { categoryOptions, networkOptions, type CatalogNft, type CatalogParams, type CatalogResponse } from '@/types/catalog'
import { defaultCatalogParams, normalizeEth } from './catalog-params'
import { useCatalog } from './use-catalog'
import { FavoriteButton } from '@/features/cart/favorite-button'

export type CatalogChange = (patch: Partial<CatalogParams>, options?: { replace?: boolean }) => void
type ControlsProps = { params: CatalogParams; onChange?: CatalogChange }

function SearchForm({ params, onChange, autoFocus = false }: ControlsProps & { autoFocus?: boolean }) {
 const [draft, setDraft] = useState(params.search)
 useEffect(() => setDraft(params.search), [params.search])
 return <form role="search" onSubmit={event => { event.preventDefault(); onChange?.({ search: draft }) }}>
  <label><button type="submit" disabled={!onChange} aria-label="Executar busca" title="Buscar NFTs"><Search aria-hidden="true"/></button><input autoFocus={autoFocus} disabled={!onChange} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Explorar coleÃ§Ãµes" aria-label="Buscar NFTs" maxLength={120}/></label>
 </form>
}
export function MobileCatalogSearch(props: ControlsProps & { onOpen: () => void }) {
 return <div className="mobile-search"><SearchForm {...props}/><Button disabled={!props.onChange} size="icon" aria-label="Abrir filtros" onClick={props.onOpen}><SlidersHorizontal/></Button></div>
}

function SortControl({ params, onChange }: ControlsProps) {
 return <label className="sort-label">Ordenar por:<select disabled={!onChange} value={params.sort} aria-label="Ordenar NFTs" onChange={event => onChange?.({ sort: event.target.value as CatalogParams['sort'] })}>
  <option value="reference">Ordem da referÃªncia</option><option value="price-asc">Menor preÃ§o</option><option value="price-desc">Maior preÃ§o</option><option value="name-asc">Nome Aâ€“Z</option>
 </select></label>
}

function FilterPanel({ params, onChange, facets }: ControlsProps & { facets?: CatalogResponse['facets'] }) {
 const [min, setMin] = useState(params.minPrice || '0.02')
 const [max, setMax] = useState(params.maxPrice || '12.30')
 useEffect(() => { setMin(params.minPrice || '0.02'); setMax(params.maxPrice || '12.30') }, [params.minPrice, params.maxPrice])
 const submitPrice = (event: FormEvent) => { event.preventDefault(); onChange?.({ minPrice: normalizeEth(min), maxPrice: normalizeEth(max) }) }
 return <div className="filter-panel">
  <h2>ColeÃ§Ãµes</h2><ul>{categoryOptions.map(([value, label]) => <li key={value}><button disabled={!onChange} aria-pressed={params.category === value} onClick={() => onChange?.({ category: params.category === value ? '' : value })}><span>{label}</span><span>({facets?.categories.find(option => option.value === value)?.count ?? 'â€”'})</span></button></li>)}</ul>
  <h2>Faixa de preÃ§o</h2><form onSubmit={submitPrice}><div className="price-track" aria-hidden="true"><i/><i/></div><div className="catalog-price-inputs muted">PreÃ§o: <input disabled={!onChange} aria-label="PreÃ§o mÃ­nimo em ETH" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,18})?" maxLength={25} value={min} onChange={event => setMin(event.target.value)}/> - <input disabled={!onChange} aria-label="PreÃ§o mÃ¡ximo em ETH" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,18})?" maxLength={25} value={max} onChange={event => setMax(event.target.value)}/> ETH</div><Button disabled={!onChange} type="submit">Aplicar</Button></form>
  <h2>Rede</h2><ul>{networkOptions.map(([value, label]) => <li key={value}><button disabled={!onChange} aria-pressed={params.network === value} onClick={() => onChange?.({ network: params.network === value ? '' : value })}><span>{label}</span><span>({facets?.networks.find(option => option.value === value)?.count ?? 'â€”'})</span></button></li>)}</ul>
  <p className="catalog-classification-note">ClassificaÃ§Ãµes exibidas somente quando confirmadas.</p>
  {(params.search || params.category || params.network || params.minPrice || params.maxPrice) && <button className="catalog-reset" disabled={!onChange} onClick={() => onChange?.(defaultCatalogParams)}>Limpar filtros</button>}
 </div>
}

function FilterDialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
 const ref = useRef<HTMLDialogElement>(null)
 useEffect(() => {
  const dialog = ref.current!
  if (open && !dialog.open) dialog.showModal()
  if (!open && dialog.open) dialog.close()
 }, [open])
 return <dialog ref={ref} className="catalog-filter-dialog" aria-labelledby="filter-dialog-title" onCancel={onClose} onClose={onClose}>
  <header><h2 id="filter-dialog-title">Filtros do catÃ¡logo</h2><Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar filtros"><X/></Button></header>{children}<Button onClick={onClose}>Ver resultados</Button>
 </dialog>
}

function PageSizeControl({ params, onChange }: ControlsProps) {
 return <label className="catalog-page-size">Itens por pÃ¡gina <select disabled={!onChange} aria-label="Itens por pÃ¡gina" value={params.pageSize} onChange={event => onChange?.({ pageSize: Number(event.target.value) as CatalogParams['pageSize'] })}>{[3, 6, 9].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
}

function Skeletons({ count }: { count: number }) {
 return <div className="nft-grid catalog-skeletons" aria-hidden="true">{Array.from({ length: count }, (_, index) => <article className="nft-card" key={index}><div className="nft-image"><div className="catalog-skeleton-art catalog-shimmer"/></div><h3 className="catalog-skeleton-line catalog-shimmer">&nbsp;</h3><p className="catalog-skeleton-line catalog-shimmer">&nbsp;</p></article>)}</div>
}

export function NftCard({ nft, artwork, params, preview, priority = false }: { nft: CatalogNft; artwork?: NftArtworkKey; params: CatalogParams; preview: boolean; priority?: boolean }) {
 return <article className="nft-card" data-nft-id={nft.id}><div className="nft-image"><NftArtwork artwork={artwork ?? nft.artwork} priority={priority}/><FavoriteButton nftId={nft.id} name={nft.name} className="card-favorite-preview" preview={preview} subtle={nft.id !== 'emerald-ape-042'}/></div><h3>{preview ? nft.name : <Link className="nft-detail-link" to="/nfts/$nftId" params={{ nftId: nft.id }} search={{ ...params, edition: '', quantity: 1 }} aria-label={`Ver detalhes de ${nft.name}`}>{nft.name}</Link>}</h3><p>{nft.priceEth} ETH{nft.previousPriceEth && <del>{nft.previousPriceEth} ETH</del>}</p></article>
}
const authArtworks: NftArtworkKey[] = ['golden', 'ivory', 'emerald', 'sage', 'golden', 'ivory', 'emerald', 'sage', 'golden']
const subscribeMobile = (callback: () => void) => {
 const media = window.matchMedia('(max-width: 800px)')
 media.addEventListener('change', callback)
 return () => media.removeEventListener('change', callback)
}

export function Catalog({ params, onChange, authBackdrop, filtersOpen, onCloseFilters }: ControlsProps & { authBackdrop: boolean; filtersOpen: boolean; onCloseFilters: () => void }) {
 const query = useCatalog(params)
 const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia('(max-width: 800px)').matches, () => false)
 const data = query.data
 useEffect(() => {
  if (data && !query.isPlaceholderData && data.page !== params.page) onChange?.({ page: data.page }, { replace: true })
 }, [data, params.page, query.isPlaceholderData, onChange])
 // Apenas a ordem visual inicial mobile difere no frame; cada card mantÃ©m sua identidade e preÃ§o.
 let items = data?.items ?? []
 const referenceMobile = mobile && params.sort === 'reference' && params.page === 1 && params.pageSize === 9 && !params.search && !params.category && !params.network && !params.minPrice && !params.maxPrice
 if (referenceMobile) {
  const golden = items.find(item => item.id === 'golden-beat-207')
  if (golden) { items = items.filter(item => item.id !== golden.id); items = [...items.slice(0, 3), golden, ...items.slice(3)] }
 }
 const controls = { params, onChange, facets: data?.facets }
 const pages = Math.max(1, data?.totalPages ?? 1)
 return <>
  <section id="catalogo" className="catalog-layout" aria-label="CatÃ¡logo de NFTs" aria-describedby="catalog-status">
   <aside className="catalog-sidebar"><FilterPanel {...controls}/><div className="featured-panel"><h2>NFT EM DESTAQUE</h2><p>OFERTA LIMITADA</p><NftArtwork artwork="sage"/></div></aside>
   <div className={`catalog-content ${query.isFetching && !query.isPending ? 'catalog-updating' : ''}`}>
    <div className="catalog-toolbar"><div className="catalog-tabs" aria-label="Categorias do catÃ¡logo"><button className="selected" disabled={!onChange} onClick={() => onChange?.(defaultCatalogParams)}>Todos os NFTs</button><button disabled>Novos lanÃ§amentos</button><button disabled>Em alta</button></div><details className="catalog-search-disclosure"><summary aria-label="Abrir busca do catÃ¡logo"><Search aria-hidden="true"/></summary><SearchForm {...controls}/></details><SortControl {...controls}/></div>
    <div className="catalog-results" aria-busy={query.isFetching}>
     {query.isPending ? <Skeletons count={params.pageSize}/> : query.isError ? <div className="catalog-feedback" role="alert"><h2>NÃ£o foi possÃ­vel carregar o catÃ¡logo</h2><p>Ocorreu um erro ao consultar os NFTs. Tente novamente.</p><Button disabled={query.isFetching} onClick={() => void query.refetch()}>Tentar novamente</Button></div> : items.length === 0 ? <div className="catalog-feedback"><h2>Nenhum NFT encontrado</h2><p>Tente outra busca ou ajuste os filtros.</p>{onChange && <Button onClick={() => onChange(defaultCatalogParams)}>Limpar filtros</Button>}</div> : <div className="nft-grid">{items.map((nft, index) => <NftCard key={nft.id} nft={nft} params={params} preview={authBackdrop} artwork={authBackdrop ? authArtworks[index] : undefined} priority={index === 0}/>)}</div>}
    </div>
    <div className="catalog-bottom"><p id="catalog-status" className="catalog-note" role="status" aria-live="polite">{query.isFetching ? (query.isPending ? 'Carregando catÃ¡logoâ€¦' : 'Atualizando catÃ¡logoâ€¦') : query.isError ? 'CatÃ¡logo indisponÃ­vel.' : `${data?.total ?? 0} NFTs encontrados Â· PÃ¡gina ${data?.page ?? 1} de ${pages}`}</p><PageSizeControl {...controls}/><nav className="pagination" aria-label="PaginaÃ§Ã£o do catÃ¡logo">{Array.from({ length: pages }, (_, index) => index + 1).map(page => <button key={page} disabled={!onChange || query.isFetching || page === params.page || !data?.total} className={page === params.page ? 'selected' : undefined} aria-current={page === params.page ? 'page' : undefined} aria-label={`PÃ¡gina ${page}`} onClick={() => onChange?.({ page })}>{page}</button>)}<button aria-label="PrÃ³xima pÃ¡gina" disabled={!onChange || query.isFetching || params.page >= pages || query.isError} onClick={() => onChange?.({ page: params.page + 1 })}><ChevronRight aria-hidden="true"/></button></nav></div>
   </div>
  </section>
  <FilterDialog open={filtersOpen} onClose={onCloseFilters}><FilterPanel {...controls}/><SortControl {...controls}/></FilterDialog>
 </>
}

