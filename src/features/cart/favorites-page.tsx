import { PageHeading } from '@/components/visual-preview'
import { Button } from '@/components/ui/button'
import { NftCard } from '@/features/catalog/catalog'
import { defaultCatalogParams } from '@/features/catalog/catalog-params'
import { useFavorites } from './use-commerce'

export function FavoritesPage() {
 const query = useFavorites()
 return <div className="preview-page favorites-page"><PageHeading title="Favoritos"/><h1 className="desktop-copy">Favoritos</h1>
  <section aria-label="NFTs favoritos" aria-busy={query.isFetching || query.pending}>
   {query.isPending ? <><p role="status">Carregando favoritos…</p><div className="nft-grid">{[0, 1, 2, 3].map(index => <article className="nft-card" key={index}><div className="catalog-skeleton-art catalog-shimmer"/></article>)}</div></> : query.isError ? <div className="catalog-feedback" role="alert"><h2>Não foi possível carregar favoritos</h2><Button onClick={() => void query.refetch()}>Tentar novamente</Button></div> : !query.data?.items.length ? <div className="catalog-feedback"><h2>Você ainda não tem favoritos</h2><p>Favorite um NFT no catálogo ou no detalhe.</p></div> : <div className="nft-grid">{query.data.items.map(nft => <NftCard key={nft.id} nft={nft} params={defaultCatalogParams} preview={false}/>)}</div>}
  </section>
 </div>
}
