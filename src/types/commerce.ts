import type { CatalogNft } from './catalog'

export interface FavoritesResponse { userId: string; nftIds: string[]; items: CatalogNft[]; version: number }
export interface CartInput { nftId: string; edition: string | null; quantity: number }
export interface CartItem extends CartInput {
 id: string
 nft: CatalogNft
 tokenId: string | null
 editionLabel: string | null
 unitPriceEth: string
 subtotalEth: string
 availableQuantity: number | null
}
export interface CartResponse {
 ownerId: string
 version: number
 items: CartItem[]
 coupon: { code: string; discountBasisPoints: number; source: 'mock-fixture' } | null
 subtotalEth: string
 discountEth: string
 totalBeforeNetworkFeeEth: string
 networkFeeEth: string | null
 totalEth: string | null
 quoteStatus: 'checkout-required'
 recommendations: CatalogNft[]
}
export interface CommerceErrorBody { code: string; message: string; fields?: Record<string, string> }
