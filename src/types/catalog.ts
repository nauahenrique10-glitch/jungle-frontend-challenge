import type { NftArtworkKey } from '@/components/nft-artwork'

export const categoryOptions = [
 ['arte-digital', 'Arte digital'], ['fotografia', 'Fotografia'], ['musica', 'Música'],
 ['arte-3d', 'Arte 3D'], ['colecionaveis', 'Colecionáveis'], ['generativa', 'Generativa'],
 ['jogos', 'Jogos'], ['assinaturas', 'Assinaturas'], ['utilidade', 'Utilidade'],
] as const
export const networkOptions = [['ethereum', 'Ethereum'], ['polygon', 'Polygon'], ['solana', 'Solana']] as const
export type Category = typeof categoryOptions[number][0]
export type Network = typeof networkOptions[number][0]
export type CatalogSort = 'reference' | 'price-asc' | 'price-desc' | 'name-asc'
export interface CatalogParams {
 search: string
 category: Category | ''
 network: Network | ''
 minPrice: string
 maxPrice: string
 sort: CatalogSort
 page: number
 pageSize: 3 | 6 | 9
}
/** Somente campos comprovados; ids são identificadores técnicos, não tokens on-chain. */
export interface CatalogNft {
 version: number
 id: string
 name: string
 priceEth: string
 previousPriceEth?: string
 artwork: NftArtworkKey
 category: Category | null
 network: Network | null
}
export interface CatalogResponse {
 items: CatalogNft[]
 total: number
 page: number
 pageSize: number
 totalPages: number
 facets: {
  categories: { value: Category; label: string; count: number }[]
  networks: { value: Network; label: string; count: number }[]
 }
}
