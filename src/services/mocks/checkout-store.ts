import type { AuthDatabase } from './auth-store'
import type { AuthSession } from '@/types/auth'
import type { CheckoutWallet, Order, OrderInput, Quote, QuoteInput, WalletConnection } from '@/types/checkout'
import { cartView, CommerceFailure, storedCart, validateItem } from './commerce-store'
import { fromWei, toWei } from '../eth'
import { accountWallets } from './account-store'

interface StoredOrder { order: Order; fingerprint: string; key: string; outcome: 'confirmed' | 'refused'; resolveAt: number; reconciled: boolean; removedAtCreation: Record<string, string> }
export interface CheckoutDatabase {
 quotes: Record<string, Quote>; connections: Record<string, WalletConnection & { sessionId: string }>;
 orders: Record<string, StoredOrder>; revisions: Record<string, string>; version: number;
}
export function checkout(db: AuthDatabase): CheckoutDatabase { return db.checkout ??= { quotes: {}, connections: {}, orders: {}, revisions: {}, version: 0 } }
/** Both demo accounts (and registered mock accounts) receive reference display wallets, not real addresses. IDs are owner scoped. */
export function wallets(db: AuthDatabase, userId: string): CheckoutWallet[] {
 return accountWallets(db, userId).map(({ id, label, displayAddress, address, network }) => ({ id, label, displayAddress, address, network: network as CheckoutWallet['network'] }))
}
export function walletFor(db: AuthDatabase, userId: string, id: unknown) {
 const wallet = wallets(db, userId).find(item => item.id === id)
 if (!wallet) throw new CommerceFailure(422, 'INVALID_WALLET', 'Selecione uma carteira cadastrada na simulação.')
 return wallet
}
export function makeQuote(db: AuthDatabase, userId: string, input: QuoteInput): Quote {
 const wallet = walletFor(db, userId, input.walletId)
 if (wallet.network !== input.network) throw new CommerceFailure(422, 'INVALID_NETWORK', 'Rede incompatível com a carteira selecionada.')
 const cart = cartView(db, `user:${userId}`)
 if (!cart.items.length) throw new CommerceFailure(409, 'EMPTY_CART', 'Seu carrinho está vazio.')
 cart.items.forEach(item => validateItem(item, db))
 const revision = checkout(db).revisions[userId]
 const items = cart.items.map(item => {
  const unitPriceEth = revision === 'price-changed' ? fromWei(toWei(item.unitPriceEth) + toWei('0.01')) : item.unitPriceEth
  return { ...item, nft: { ...item.nft, priceEth: unitPriceEth }, unitPriceEth, subtotalEth: fromWei(toWei(unitPriceEth) * BigInt(item.quantity)) }
 })
 const subtotal = items.reduce((sum, item) => sum + toWei(item.subtotalEth), 0n)
 const coupon = revision === 'coupon-expired' ? null : cart.coupon
 const discount = coupon ? subtotal * BigInt(coupon.discountBasisPoints) / 10_000n : 0n
 // Reference fee, explicitly simulated. Polygon uses the same ETH-denominated demo quote, no real gas estimation.
 const fee = toWei(revision === 'fee-changed' ? '0.018' : '0.016')
 const quote: Quote = { quoteId: crypto.randomUUID(), userId, version: ++checkout(db).version, cartVersion: cart.version, items,
  subtotalEth: fromWei(subtotal), discountEth: fromWei(discount), networkFeeEth: fromWei(fee), totalEth: fromWei(subtotal - discount + fee),
  coupon: coupon?.code ?? null, currency: 'ETH', network: wallet.network, walletId: wallet.id, expiresAt: new Date(Date.now() + 120_000).toISOString() }
 checkout(db).quotes[quote.quoteId] = structuredClone(quote)
 return quote
}
const terms = (quote: Quote) => JSON.stringify({ items: quote.items.map(item => [item.id, item.nftId, item.edition, item.quantity, item.unitPriceEth]), subtotal: quote.subtotalEth, discount: quote.discountEth, fee: quote.networkFeeEth, total: quote.totalEth, coupon: quote.coupon, network: quote.network, wallet: quote.walletId })
export function createOrder(db: AuthDatabase, session: AuthSession, input: OrderInput, key: string, scenario: string): Order | { changed: Quote } {
 const state = checkout(db)
 const fingerprint = JSON.stringify([input.quoteId, input.quoteVersion, input.connectionId])
 const previous = Object.values(state.orders).find(record => record.order.userId === session.user.id && record.key === key)
 if (previous) {
  if (previous.fingerprint !== fingerprint) throw new CommerceFailure(409, 'IDEMPOTENCY_CONFLICT', 'A chave desta tentativa já foi usada com outros dados.')
  return structuredClone(previous.order)
 }
 if (Object.values(state.orders).some(record => record.order.userId === session.user.id && record.order.status === 'pending')) throw new CommerceFailure(409, 'ORDER_PENDING', 'Existe um pedido pendente. Recupere-o antes de tentar outra compra.')
 const quote = state.quotes[input.quoteId]
 if (!quote || quote.userId !== session.user.id || input.quoteVersion !== quote.version) throw new CommerceFailure(409, 'INVALID_QUOTE', 'Cotação inválida. Solicite outra cotação.')
 const connection = state.connections[input.connectionId]
 if (!connection?.connected || connection.userId !== session.user.id || connection.sessionId !== session.id || connection.wallet.id !== quote.walletId) throw new CommerceFailure(409, 'WALLET_DISCONNECTED', 'Conecte a carteira selecionada novamente.')
 if (['price-changed', 'fee-changed', 'coupon-expired'].includes(scenario)) state.revisions[session.user.id] = scenario
 if (scenario === 'coupon-expired') {
  const cart = storedCart(db, `user:${session.user.id}`)
  if (cart.coupon) { cart.coupon = null; cart.version++ }
 }
 const fresh = makeQuote(db, session.user.id, { walletId: quote.walletId, network: quote.network })
 if (terms(fresh) !== terms(quote) || Date.parse(quote.expiresAt) <= Date.now()) return { changed: fresh }
 const user = session.user
 const order: Order = { id: crypto.randomUUID(), userId: user.id, version: 1, status: 'pending', createdAt: new Date().toISOString(), resolvedAt: null, transactionId: null,
  user: { id: user.id, displayName: user.displayName, username: user.username, email: user.email }, wallet: structuredClone(connection.wallet), provider: connection.provider, quote: structuredClone(quote) }
 state.orders[order.id] = { order, fingerprint, key, outcome: scenario === 'payment-refused' ? 'refused' : 'confirmed', resolveAt: Date.now() + 2000, reconciled: false, removedAtCreation: Object.fromEntries(storedCart(db, `user:${user.id}`).items.map(item => [item.id, item.removedUnits ?? '0'])) }
 return structuredClone(order)
}
export function readOrder(db: AuthDatabase, userId: string, id: string, scenario: string): Order {
 const record = checkout(db).orders[id]
 if (!record || record.order.userId !== userId) throw new CommerceFailure(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado para este usuário.')
 const order = record.order
 if (order.status === 'pending' && scenario !== 'pending' && Date.now() >= record.resolveAt) {
  order.status = record.outcome; order.version++; order.resolvedAt = new Date().toISOString()
  if (order.status === 'confirmed') {
   order.transactionId = `simulated:${order.id}`
   if (!record.reconciled) {
    const cart = storedCart(db, `user:${userId}`)
    // Match line identity too: removing/re-adding a line must not consume a new purchase intent.
    for (const purchased of order.quote.items) {
     const current = cart.items.find(item => item.id === purchased.id && item.nftId === purchased.nftId && item.edition === purchased.edition)
     if (current) {
      const removedSince = BigInt(current.removedUnits ?? '0') - BigInt(record.removedAtCreation?.[purchased.id] ?? '0')
      const remaining = BigInt(purchased.quantity) - removedSince
      const consume = remaining <= 0n ? 0 : Number(remaining > BigInt(current.quantity) ? BigInt(current.quantity) : remaining)
      current.quantity -= consume
      current.removedUnits = (BigInt(current.removedUnits ?? '0') + BigInt(consume)).toString()
     }
    }
    cart.items = cart.items.filter(item => item.quantity > 0); cart.version++; record.reconciled = true
   }
  }
 }
 return structuredClone(order)
}

