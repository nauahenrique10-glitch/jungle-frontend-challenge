import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { NftArtwork } from '@/components/nft-artwork'
import { buttonVariants } from '@/components/ui/button'
import type { CatalogParams } from '@/types/catalog'
import { HomeSections } from './home-sections'
import { Catalog, MobileCatalogSearch, type CatalogChange } from './catalog'
import { defaultCatalogParams } from './catalog-params'

export function HomePage({ authBackdrop = false, params = defaultCatalogParams, onParamsChange }: {
 authBackdrop?: boolean; params?: CatalogParams; onParamsChange?: CatalogChange
} = {}) {
 const [filtersOpen, setFiltersOpen] = useState(false)
 return <div className="home-page">
  <MobileCatalogSearch params={params} onChange={onParamsChange} onOpen={() => setFiltersOpen(true)}/>
  <section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><p className="eyebrow">Bem-vindo à Kurio</p><h1 id="hero-title"><span className="desktop-copy">SEJA DONO DO FUTURO<br/>DA ARTE DIGITAL</span><span className="mobile-copy">SEJA DONO DA<br/>CULTURA DIGITAL</span></h1><p className="desktop-copy">Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</p><p className="mobile-copy">Descubra NFTs selecionados de criadores do mundo todo.</p><a className={`${buttonVariants()} hero-cta`} href="#catalogo">EXPLORAR <ArrowRight aria-hidden="true"/></a></div><div className="hero-art-group"><NftArtwork artwork="emerald" className="hero-art" priority/><div className="hero-miniature"><NftArtwork artwork="sage" decorative/></div></div><div className="hero-indicators" aria-hidden="true"><i/><i/><i/></div></section>
  <Catalog params={params} onChange={onParamsChange} authBackdrop={authBackdrop} filtersOpen={filtersOpen} onCloseFilters={() => setFiltersOpen(false)}/>
  <HomeSections/>
 </div>
}