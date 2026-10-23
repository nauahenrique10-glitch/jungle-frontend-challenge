import type { CatalogNft } from '@/types/catalog'
import type { AuthDatabase } from './auth-store'
import type { NftUpdate } from '@/types/realtime'
import { toWei } from '../eth'

export type MarketDatabase = Record<string, { priceEth: string; version: number; updatedAt: string }>
export function marketNft<T extends CatalogNft>(db: AuthDatabase, nft: T): T {
 const override = db.market?.[nft.id]
 return override ? { ...nft, ...override } : { ...nft, version: 1 }
}
/** Scenario prices are explicit mock conditions. Unknown availability always remains null. */
export function updateMarket(db: AuthDatabase, nft: CatalogNft, priceEth: string): NftUpdate {
 if (toWei(priceEth) <= 0n) throw new Error('Preço de cenário inválido.')
 const old = marketNft(db, nft)
 const record = { priceEth, version: old.version + 1, updatedAt: new Date().toISOString() }
 ;(db.market ??= {})[nft.id] = record
 for (const cart of Object.values(db.commerce?.carts ?? {})) if (cart.items.some(item => item.nftId === nft.id)) cart.version++
 return { eventId: crypto.randomUUID(), resourceId: nft.id, version: record.version, updatedAt: record.updatedAt, payload: { priceEth, availableQuantity: null } }
}
