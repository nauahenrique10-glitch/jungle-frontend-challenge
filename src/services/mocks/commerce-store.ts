import { marketNft } from './market-store'
import type { AuthDatabase } from './auth-store'
import type { CartInput, CartResponse, FavoritesResponse } from '@/types/commerce'
import { catalogFixtures } from './catalog-fixtures'
import { findNftDetail } from './nft-detail-fixtures'
import { editionAvailability } from '../nft-availability'
import { fromWei, toWei } from '../eth'

interface StoredCart { items: (CartInput & { id: string; removedUnits?: string })[]; coupon: string | null; version: number; sealed: boolean; operations: Record<string, string> }
export interface CommerceDatabase { favorites: Record<string, { ids: string[]; version: number }>; carts: Record<string, StoredCart> }
export class CommerceFailure extends Error {
 constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) { super(message) }
}
export const couponFixtures = {
 TESTE10: { code: 'TESTE10', discountBasisPoints: 1000, source: 'mock-fixture' as const },
}
export function commerce(db: AuthDatabase): CommerceDatabase { return db.commerce ??= { favorites: {}, carts: {} } }
export function storedCart(db: AuthDatabase, owner: string): StoredCart {
 return commerce(db).carts[owner] ??= { items: [], coupon: null, version: 0, sealed: false, operations: {} }
}
export function validateItem(input: CartInput, db?: AuthDatabase): void {
 if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) throw new CommerceFailure(422, 'INVALID_QUANTITY', 'Informe uma quantidade inteira de pelo menos 1.', { quantity: 'Quantidade inválida.' })
 const nft = findNftDetail(input.nftId, db)
 if (!nft) throw new CommerceFailure(404, 'NFT_NOT_FOUND', 'NFT não encontrado.')
 if (nft.editions.length ? !nft.editions.some(option => option.id === input.edition) : input.edition !== null) throw new CommerceFailure(422, 'INVALID_EDITION', 'Edição não confirmada para este NFT.', { edition: 'Selecione uma edição confirmada.' })
 const available = editionAvailability(nft, input.edition)
 if (available !== null && input.quantity > available) throw new CommerceFailure(409, 'EDITION_UNAVAILABLE', 'Quantidade superior à disponibilidade confirmada.')
}
export function favoritesView(db: AuthDatabase, userId: string): FavoritesResponse {
 const record = commerce(db).favorites[userId] ??= { ids: [], version: 0 }
 return { userId, nftIds: [...record.ids], version: record.version, items: record.ids.flatMap(id => catalogFixtures.filter(nft => nft.id === id).map(nft => marketNft(db, nft))) }
}
export function cartView(db: AuthDatabase, owner: string): CartResponse {
 const cart = storedCart(db, owner)
 const items = cart.items.map(item => {
  const nft = findNftDetail(item.nftId, db)!
  return { id: item.id, nftId: item.nftId, edition: item.edition, quantity: item.quantity, nft, tokenId: nft.tokenId, editionLabel: nft.editions.find(option => option.id === item.edition)?.label ?? null, availableQuantity: editionAvailability(nft, item.edition), unitPriceEth: nft.priceEth, subtotalEth: fromWei(toWei(nft.priceEth) * BigInt(item.quantity)) }
 })
 const subtotal = items.reduce((sum, item) => sum + toWei(item.subtotalEth), 0n)
 const coupon = cart.coupon === 'TESTE10' ? couponFixtures.TESTE10 : null
 const discount = coupon ? subtotal * BigInt(coupon.discountBasisPoints) / 10_000n : 0n
 return {
  ownerId: owner, version: cart.version, items, coupon, subtotalEth: fromWei(subtotal), discountEth: fromWei(discount), totalBeforeNetworkFeeEth: fromWei(subtotal - discount),
  networkFeeEth: null, totalEth: null, quoteStatus: 'checkout-required',
  recommendations: ['cosmic-bloom-118', 'violet-nomad-314', 'ivory-baron-088', 'golden-beat-207', 'golden-signal-160'].flatMap(id => catalogFixtures.filter(nft => nft.id === id).map(nft => marketNft(db, nft))),
 }
}
/** Atomic inside the same auth database lock; consume and seal only after validating the whole merge. */
export function mergeGuestCart(db: AuthDatabase, userId: string, guestId: string | null): void {
 if (!guestId || !/^[a-f0-9-]{36}$/i.test(guestId)) return
 const guest = storedCart(db, `guest:${guestId}`)
 if (guest.sealed) return
 const target = storedCart(db, `user:${userId}`)
 const merged = structuredClone(target.items)
 for (const source of guest.items) {
  const existing = merged.find(item => item.nftId === source.nftId && item.edition === source.edition)
  const input = { ...source, quantity: source.quantity + (existing?.quantity ?? 0) }
  validateItem(input, db)
  if (existing) existing.quantity = input.quantity
  else merged.push({ ...source, id: crypto.randomUUID() })
 }
 target.items = merged
 // User coupon wins; an eligible guest coupon transfers only if the user has none.
 target.coupon ??= guest.coupon
 target.version++
 guest.items = []; guest.coupon = null; guest.sealed = true; guest.version++
}

