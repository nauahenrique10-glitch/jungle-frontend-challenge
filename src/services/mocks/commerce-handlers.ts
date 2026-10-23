import { delay, http, HttpResponse } from 'msw'
import { withAuthDatabase, type AuthDatabase } from './auth-store'
import { current } from './auth-handlers'
import { cartView, commerce, CommerceFailure, favoritesView, storedCart, validateItem } from './commerce-store'
import { findNftDetail } from './nft-detail-fixtures'
import type { CartInput } from '@/types/commerce'

const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
export const commerceScenarios = ['success', 'latency', 'error500', 'mutation-error', 'offline', 'coupon-invalid', 'coupon-expired'] as const
const scenario = () => localStorage.getItem('kurio:commerce-scenario') || import.meta.env.VITE_COMMERCE_SCENARIO || 'success'
type Action = (db: AuthDatabase, owner: string, body: Record<string, unknown>) => ReturnType<typeof cartView> | ReturnType<typeof favoritesView>
async function handle(request: Request, action: Action, authenticated = false) {
 const configured = scenario()
 await delay(configured === 'latency' ? 1200 : 100)
 if (configured === 'offline') return HttpResponse.error()
 if (configured === 'error500' || configured === 'mutation-error' && request.method !== 'GET') return HttpResponse.json({ code: 'COMMERCE_UNAVAILABLE', message: 'Não foi possível concluir a operação. Tente novamente.' }, { status: 500 })
 let body: Record<string, unknown> = {}
 if (request.method === 'POST' || request.method === 'PATCH') {
  try { const value = await request.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); body = value }
  catch { return HttpResponse.json({ code: 'INVALID_BODY', message: 'Dados da operação inválidos.' }, { status: 422 }) }
 }
 return withAuthDatabase(async db => {
  let owner: string
  if (authenticated || request.headers.has('Authorization')) {
   const identity = await current(db, request)
   if (identity.failure) return identity.failure
   owner = `user:${identity.session!.user.id}`
  } else {
   const guest = request.headers.get('X-Kurio-Guest')
   if (!guest || !/^[a-f0-9-]{36}$/i.test(guest)) return HttpResponse.json({ code: 'GUEST_REQUIRED', message: 'Identificação de visitante inválida.' }, { status: 401 })
   owner = `guest:${guest}`
  }
  try {
   const cart = storedCart(db, owner)
   const isMutation = request.method !== 'GET'
   if (isMutation && cart.sealed) throw new CommerceFailure(409, 'GUEST_CART_MERGED', 'Este carrinho de visitante já foi mesclado. Atualize a página.')
   const key = request.headers.get('Idempotency-Key')
   const fingerprint = JSON.stringify([request.method, new URL(request.url).pathname, body])
   if (isMutation && key && cart.operations[key]) {
    if (cart.operations[key] !== fingerprint) throw new CommerceFailure(409, 'IDEMPOTENCY_CONFLICT', 'A tentativa já foi usada com outros dados.')
    return HttpResponse.json(authenticated ? favoritesView(db, owner.slice(5)) : cartView(db, owner))
   }
   const result = action(db, owner, body)
   if (isMutation && key) {
    cart.operations[key] = fingerprint
    const entries = Object.keys(cart.operations)
    if (entries.length > 200) delete cart.operations[entries[0]]
   }
   return HttpResponse.json(result)
  } catch (error) {
   if (error instanceof CommerceFailure) return HttpResponse.json({ code: error.code, message: error.message, fields: error.fields }, { status: error.status })
   throw error
  }
 })
}
export const commerceHandlers = [
 http.get(`${base}/favorites`, ({ request }) => handle(request, (db, owner) => favoritesView(db, owner.slice(5)), true)),
 http.post(`${base}/favorites/:nftId`, ({ request, params }) => handle(request, (db, owner) => {
  const id = String(params.nftId)
  if (!findNftDetail(id)) throw new CommerceFailure(404, 'NFT_NOT_FOUND', 'NFT não encontrado.')
  const userId = owner.slice(5)
  favoritesView(db, userId)
  const favorite = commerce(db).favorites[userId]
  if (!favorite.ids.includes(id)) { favorite.ids.push(id); favorite.version++ }
  return favoritesView(db, userId)
 }, true)),
 http.delete(`${base}/favorites/:nftId`, ({ request, params }) => handle(request, (db, owner) => {
  const userId = owner.slice(5)
  favoritesView(db, userId)
  const favorite = commerce(db).favorites[userId]
  favorite.ids = favorite.ids.filter(id => id !== params.nftId); favorite.version++
  return favoritesView(db, userId)
 }, true)),
 http.get(`${base}/cart`, ({ request }) => handle(request, (db, owner) => cartView(db, owner))),
 http.post(`${base}/cart/items`, ({ request }) => handle(request, (db, owner, body) => {
  const input = { nftId: body.nftId, edition: body.edition, quantity: body.quantity } as CartInput
  validateItem(input, db)
  const cart = storedCart(db, owner)
  const existing = cart.items.find(item => item.nftId === input.nftId && item.edition === input.edition)
  const next = { ...input, quantity: input.quantity + (existing?.quantity ?? 0) }
  validateItem(next, db)
  if (existing) existing.quantity = next.quantity
  else cart.items.push({ ...next, id: crypto.randomUUID() })
  cart.version++
  return cartView(db, owner)
 })),
 http.patch(`${base}/cart/items/:itemId`, ({ request, params }) => handle(request, (db, owner, body) => {
  const cart = storedCart(db, owner)
  const item = cart.items.find(item => item.id === params.itemId)
  if (!item) throw new CommerceFailure(404, 'ITEM_NOT_FOUND', 'Item não encontrado neste carrinho.')
  const input = { ...item, quantity: body.quantity } as CartInput
  validateItem(input, db)
  if (input.quantity < item.quantity) item.removedUnits = (BigInt(item.removedUnits ?? '0') + BigInt(item.quantity - input.quantity)).toString()
  item.quantity = input.quantity; cart.version++
  return cartView(db, owner)
 })),
 http.delete(`${base}/cart/items/:itemId`, ({ request, params }) => handle(request, (db, owner) => {
  const cart = storedCart(db, owner)
  cart.items = cart.items.filter(item => item.id !== params.itemId); cart.version++
  return cartView(db, owner)
 })),
 http.post(`${base}/cart/coupon`, ({ request }) => handle(request, (db, owner, body) => {
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (code === 'TESTEEXPIRADO' || scenario() === 'coupon-expired') throw new CommerceFailure(410, 'COUPON_EXPIRED', 'Este cupom expirou.', { code: 'Cupom expirado.' })
  if (code !== 'TESTE10' || scenario() === 'coupon-invalid') throw new CommerceFailure(422, 'COUPON_INVALID', 'Código promocional inválido.', { code: 'Cupom inválido.' })
  const cart = storedCart(db, owner)
  cart.coupon = code; cart.version++
  return cartView(db, owner)
 })),
 http.delete(`${base}/cart/coupon`, ({ request }) => handle(request, (db, owner) => {
  const cart = storedCart(db, owner)
  cart.coupon = null; cart.version++
  return cartView(db, owner)
 })),
]

