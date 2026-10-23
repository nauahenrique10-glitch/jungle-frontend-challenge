import { ArtworkPlaceholder } from './artwork-placeholder'

// Identidade dos arquivos visuais, independente dos futuros contratos do catálogo.
export const nftArtworks = {
 emerald: { src: '/assets/nfts/emerald-ape.png', alt: 'Macaco de óculos e jaqueta verde', size: 900 },
 sage: { src: '/assets/nfts/sage-nomad.png', alt: 'Macaco de chapéu verde e moletom roxo', size: 500 },
 ivory: { src: '/assets/nfts/ivory-baron.png', alt: 'Macaco de blazer creme e blusa verde', size: 500 },
 golden: { src: '/assets/nfts/golden-beat.png', alt: 'Macaco dourado com fones verdes', size: 500 },
} as const
export type NftArtworkKey = keyof typeof nftArtworks

export function NftArtwork({ artwork, mobileArtwork, className = '', priority = false, decorative = false }: {
 artwork?: NftArtworkKey; mobileArtwork?: NftArtworkKey; className?: string; priority?: boolean; decorative?: boolean
}) {
 if (!artwork) return <ArtworkPlaceholder label="Arte pendente"/>
 const art = nftArtworks[artwork]
 const mobile = mobileArtwork ? nftArtworks[mobileArtwork] : undefined
 return <picture className={`nft-artwork ${className}`}>
  {mobile && <source media="(max-width: 800px)" srcSet={mobile.src}/>}
  <img src={art.src} alt={decorative ? '' : mobile ? 'Arte de macaco da coleção Kurio' : art.alt} width={art.size} height={art.size} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async"/>
 </picture>
}
