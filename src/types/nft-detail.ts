import type { NftArtworkKey } from '@/components/nft-artwork'
import type { CatalogNft, CatalogParams } from './catalog'

export interface NftEdition { id: string; label: string; available?: boolean; availableQuantity?: number | null }
export interface NftDetail extends CatalogNft {
 tokenId: string | null
 collection: string | null
 attributes: string[]
 summary: string | null
 mobileSummary: string | null
 description: string[]
 networkDescription: string | null
 editions: NftEdition[]
 defaultEditionId: string | null
 /** null = disponibilidade desconhecida; denominador de edição não é estoque. */
 availableQuantity: number | null
 gallery: NftArtworkKey[]
 related: CatalogNft[]
 rating: { score: string; count: number } | null
}
export interface NftDetailSearch extends CatalogParams { edition: string; quantity: number }
