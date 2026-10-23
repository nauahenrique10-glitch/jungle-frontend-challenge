import { useEffect, useState } from 'react'
import { ArrowLeft, Heart, Minus, Plus, Search, ShoppingCart, Star } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { NftArtwork, type NftArtworkKey } from '@/components/nft-artwork'
import { Button } from '@/components/ui/button'
import { normalizeCatalogParams } from '@/features/catalog/catalog-params'
import type { NftDetail, NftDetailSearch } from '@/types/nft-detail'
import { normalizeQuantity } from './detail-state'
import { useNftDetail } from './use-nft-detail'
import { QuantityControl } from '@/components/quantity-control'
import { FavoriteButton } from '@/features/cart/favorite-button'
import { commerceError, useCartActions } from '@/features/cart/use-commerce'
import { editionAvailability } from '@/services/nft-availability'

type Selection = Pick<NftDetailSearch, 'edition' | 'quantity'>
type Props = { nftId: string; search: NftDetailSearch; onChange: (patch: Partial<Selection>) => void }

function BackLinks({ search, nft }: { search: NftDetailSearch; nft?: NftDetail }) {
 const context = normalizeCatalogParams({ ...search })
 return <><p className="preview-breadcrumb"><Link to="/" search={context}>Início</Link> / <Link to="/" search={context} hash="catalogo" aria-label="Voltar ao catálogo">Mercado</Link> / NFT</p><div className="preview-mobile-heading"><Link to="/" search={context} hash="catalogo" aria-label="Voltar ao catálogo"><ArrowLeft aria-hidden="true"/></Link>{nft && <FavoriteButton className="detail-mobile-favorite" nftId={nft.id} name={nft.name}/>}</div></>
}

function Gallery({ artworks }: { artworks: NftArtworkKey[] }) {
 const [active, setActive] = useState(0)
 return <div className="detail-gallery" aria-label="Galeria do NFT"><div className="detail-thumbnails">{Array.from({ length: Math.max(4, artworks.length) }, (_, index) => <button key={index} type="button" disabled={index >= artworks.length} aria-label={index < artworks.length ? `Imagem ${index + 1} do NFT` : 'Vista adicional indisponível'} title={index >= artworks.length ? 'Apenas uma imagem confirmada; vista adicional indisponível' : undefined} aria-pressed={index < artworks.length ? index === active : undefined} onClick={() => setActive(index)}><NftArtwork artwork={artworks[index] ?? artworks[0]} decorative/></button>)}</div><div className="detail-main-art"><NftArtwork artwork={artworks[active]} priority/><button disabled aria-label="Ampliar imagem indisponível"><Search/></button></div></div>
}

function DetailSkeleton() {
 return <div className="detail-grid detail-skeleton" aria-hidden="true"><div className="detail-gallery"><div className="detail-thumbnails">{[0, 1, 2, 3].map(index => <div key={index} className="detail-skeleton-square catalog-shimmer"/>)}</div><div className="detail-main-art"><div className="detail-skeleton-square catalog-shimmer"/></div></div><div className="detail-information"><div className="detail-title"><div className="detail-skeleton-title catalog-shimmer"/></div><div className="detail-price"><div className="detail-skeleton-line catalog-shimmer"/></div><div className="detail-summary detail-skeleton-summary catalog-shimmer"/><h2>Edição:</h2><div className="edition-preview"><span className="detail-skeleton-line catalog-shimmer"/></div><div className="detail-actions"><div className="detail-skeleton-line catalog-shimmer"/></div><div className="detail-skeleton-metadata catalog-shimmer"/></div></div>
}

function DetailSkeletonSections() {
 return <div aria-hidden="true" className="detail-skeleton-sections"><section className="detail-description"><div><h2>Detalhes do NFT</h2></div><div className="detail-skeleton-copy catalog-shimmer"/></section><section className="related-artworks"><h2>Mais desta coleção</h2><div>{[0, 1, 2, 3, 4].map(index => <article key={index}><div className="detail-skeleton-square catalog-shimmer"/><h3 className="detail-skeleton-line catalog-shimmer">&nbsp;</h3><p className="detail-skeleton-line catalog-shimmer">&nbsp;</p></article>)}</div><div className="related-indicators"><i/><i/><i/></div></section><div className="detail-mobile-purchase"><div className="detail-skeleton-line catalog-shimmer"/><div className="detail-skeleton-purchase catalog-shimmer"/></div></div>
}

function RelatedNfts({ nft, search }: { nft: NftDetail; search: NftDetailSearch }) {
 if (!nft.related.length) return null
 return <section className="related-artworks"><h2>Mais desta coleção</h2><div>{nft.related.map(item => <article key={item.id}><Link to="/nfts/$nftId" params={{ nftId: item.id }} search={{ ...search, edition: '', quantity: 1 }} aria-label={`Ver detalhes de ${item.name}`}><div><NftArtwork artwork={item.artwork}/></div><h3>{item.name}</h3><p>{item.priceEth} ETH</p></Link></article>)}</div><div className="related-indicators" aria-hidden="true"><i/><i/><i/></div></section>
}

export function NftDetailPage({ nftId, search, onChange }: Props) {
 const query = useNftDetail(nftId)
 const cart = useCartActions()
 const nft = query.data
 const edition = nft?.editions.find(option => option.id === search.edition)?.id ?? nft?.defaultEditionId ?? ''
 const availability = nft ? editionAvailability(nft, edition || null) : null
 const quantity = normalizeQuantity(search.quantity, availability)
 useEffect(() => {
  if (nft && (edition !== search.edition || quantity !== search.quantity)) onChange({ edition, quantity })
 }, [nft, edition, quantity, search.edition, search.quantity, onChange])
 const notFound = isAxiosError(query.error) && query.error.response?.status === 404
 const quantityProps = { value: quantity, available: availability, onChange: (value: number) => { cart.reset(); onChange({ quantity: value }) } }
 const add = () => cart.execute({ type: 'add', item: { nftId, edition: edition || null, quantity } })
 const cannotAdd = !nft || !cart.ready || cart.pending || availability === 0
 return <div className="preview-page detail-preview functional-detail" aria-busy={query.isFetching}>
  <BackLinks search={search} nft={nft}/>
  {query.isPending ? <><p className="sr-only" role="status">Carregando NFT…</p><DetailSkeleton/><DetailSkeletonSections/></> : query.isError ? <section className="detail-feedback catalog-feedback" role={notFound ? undefined : 'alert'}><h1>{notFound ? 'NFT não encontrado' : 'Não foi possível carregar o NFT'}</h1><p>{notFound ? 'Este NFT não existe no catálogo disponível.' : 'Ocorreu um erro ao consultar os detalhes. Tente novamente.'}</p>{!notFound && <Button disabled={query.isFetching} onClick={() => void query.refetch()}>Tentar novamente</Button>}<Link to="/" search={normalizeCatalogParams({ ...search })} hash="catalogo">Explorar catálogo</Link></section> : nft && <>
   <div className="detail-grid"><Gallery artworks={nft.gallery}/><section className="detail-information">
    <div className="detail-title"><h1>{nft.name}</h1><FavoriteButton nftId={nft.id} name={nft.name}/></div>
    <div className="detail-price">{nft.priceEth} ETH{nft.rating && <span className="detail-rating-desktop"><Star aria-hidden="true"/>{nft.rating.count} avaliações de colecionadores</span>}</div>
    {nft.rating && <span className="detail-rating-mobile"><Star aria-hidden="true"/>{nft.rating.score}({nft.rating.count})</span>}
    <h2>Sobre este NFT:</h2><p className="detail-summary desktop-copy">{nft.summary ?? 'Descrição deste NFT ainda não confirmada.'}</p><p className="detail-summary mobile-copy">{nft.mobileSummary ?? nft.summary ?? 'Descrição deste NFT ainda não confirmada.'}</p>
    <h2>Edição:</h2><div className="edition-preview" role="group" aria-label="Edição do NFT">{nft.editions.length ? nft.editions.map(option => <button key={option.id} type="button" disabled={option.available === false || option.availableQuantity === 0} aria-pressed={option.id === edition} onClick={() => { cart.reset(); onChange({ edition: option.id }) }}>{option.label}</button>) : <button disabled>Não informada</button>}</div>
    <div className="detail-actions"><QuantityControl {...quantityProps}/><Button disabled={cannotAdd} onClick={add}>{cart.pending ? 'Adicionando…' : 'COMPRAR'}</Button><FavoriteButton nftId={nft.id} name={nft.name} text/></div>
    <div className="detail-commerce-feedback">{cart.error && <p role="alert" className="commerce-error">{commerceError(cart.error)}</p>}{cart.succeeded && <p role="status">NFT adicionado ao carrinho. <Link to="/carrinho">Ver carrinho</Link></p>}</div>
    <dl className="detail-metadata"><div><dt>ID do token:</dt><dd>{nft.tokenId ?? 'Não informado'}</dd></div><div><dt>Coleção:</dt><dd>{nft.collection ?? 'Não informada'}</dd></div><div><dt>Atributos:</dt><dd>{nft.attributes.length ? nft.attributes.join(', ') : 'Não informados'}</dd></div></dl>
    <p className="detail-sharing">Compartilhar este NFT: <button disabled aria-label="Compartilhamento indisponível">Indisponível</button></p>
    <p className="detail-availability-note">{availability === null ? 'Disponibilidade não informada.' : availability === 0 ? 'Edição indisponível.' : 'Disponibilidade confirmada pela API.'} Adicionar ao carrinho não finaliza a compra.</p>
   </section></div>
   <section className="detail-description"><div><h2>Detalhes do NFT</h2><button disabled>Avaliações de colecionadores{nft.rating ? ` (${nft.rating.count})` : ''}</button></div>{nft.description.length ? nft.description.map(paragraph => <p key={paragraph}>{paragraph}</p>) : <p>Descrição, procedência e informações adicionais ainda não confirmadas para este NFT.</p>}<p><strong>Rede:</strong><br/>{nft.networkDescription ?? 'Informação não confirmada'}</p><p><strong>Contrato:</strong><br/>Endereço completo não disponível na referência.</p></section>
   <RelatedNfts nft={nft} search={search}/>
   <div className="detail-mobile-purchase"><div><span>Qtd.</span><QuantityControl {...quantityProps}/><strong>{nft.priceEth} ETH</strong></div><div><Button disabled={cannotAdd} onClick={add}>{cart.pending ? 'Adicionando…' : 'Comprar NFT'}</Button><Button disabled={cannotAdd} onClick={add} variant="outline" size="icon" aria-label="Adicionar ao carrinho"><ShoppingCart/></Button></div></div>
  </>}
 </div>
}
