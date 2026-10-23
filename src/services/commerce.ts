import { CanceledError } from 'axios'
import type { AuthSession } from '@/types/auth'
import type { CartInput, CartResponse, FavoritesResponse } from '@/types/commerce'
import { authGeneration, currentSession, requestForGuest, requestForSession } from './auth'
import { getGuestCartId } from './guest-cart'
import { http } from './http'

export type CommerceContext = { kind: 'user'; session: AuthSession; generation: number } | { kind: 'guest'; guestId: string; generation: number }
export function isCurrentCommerce(context: CommerceContext): boolean {
 return context.generation === authGeneration() && (context.kind === 'user' ? currentSession()?.id === context.session.id && currentSession()?.user.id === context.session.user.id : !currentSession() && getGuestCartId() === context.guestId)
}
export function commerceKey(context: CommerceContext | null, resource: 'cart' | 'favorites') {
 return !context ? ['commerce-pending', resource] as const : context.kind === 'user' ? ['private', context.session.user.id, context.session.id, context.generation, resource] as const : ['guest', context.guestId, context.generation, resource] as const
}
const ownerId = (context: CommerceContext) => context.kind === 'user' ? `user:${context.session.user.id}` : `guest:${context.guestId}`
export type CartOperation = { type: 'add'; item: CartInput } | { type: 'quantity'; itemId: string; quantity: number } | { type: 'remove'; itemId: string } | { type: 'coupon'; code: string } | { type: 'remove-coupon' }
async function cartRequest(context: CommerceContext, signal: AbortSignal | undefined, operation?: CartOperation): Promise<CartResponse> {
 const run = async (transport: { signal: AbortSignal; headers: Record<string, string> }) => {
  const config = { ...transport, headers: { ...transport.headers, ...(operation ? { 'Idempotency-Key': crypto.randomUUID() } : {}) } }
  const response = !operation ? await http.get<CartResponse>('/cart', config) : operation.type === 'add' ? await http.post<CartResponse>('/cart/items', operation.item, config) : operation.type === 'quantity' ? await http.patch<CartResponse>(`/cart/items/${encodeURIComponent(operation.itemId)}`, { quantity: operation.quantity }, config) : operation.type === 'remove' ? await http.delete<CartResponse>(`/cart/items/${encodeURIComponent(operation.itemId)}`, config) : operation.type === 'coupon' ? await http.post<CartResponse>('/cart/coupon', { code: operation.code }, config) : await http.delete<CartResponse>('/cart/coupon', config)
  if (response.data.ownerId !== ownerId(context)) throw new CanceledError('Carrinho de outro contexto.')
  return response.data
 }
 return context.kind === 'user' ? requestForSession(context.session, signal, run) : requestForGuest(context.guestId, signal, run)
}
export const getCart = (context: CommerceContext, signal?: AbortSignal) => cartRequest(context, signal)
export const changeCart = (context: CommerceContext, operation: CartOperation) => cartRequest(context, undefined, operation)
export async function favoritesRequest(context: CommerceContext, signal?: AbortSignal, change?: { nftId: string; saved: boolean }): Promise<FavoritesResponse> {
 if (context.kind !== 'user') throw new CanceledError('Favoritos exigem autenticação.')
 return requestForSession(context.session, signal, async transport => {
  const config = { ...transport, headers: { ...transport.headers, ...(change ? { 'Idempotency-Key': crypto.randomUUID() } : {}) } }
  const path = `/favorites${change ? `/${encodeURIComponent(change.nftId)}` : ''}`
  const { data } = !change ? await http.get<FavoritesResponse>(path, config) : change.saved ? await http.post<FavoritesResponse>(path, {}, config) : await http.delete<FavoritesResponse>(path, config)
  if (data.userId !== context.session.user.id) throw new CanceledError('Favoritos de outro usuário.')
  return data
 })
}
