import { CanceledError } from 'axios'
import type { AuthSession } from '@/types/auth'
import type { CheckoutWallet, Order, OrderInput, PurchaseAttempt, Quote, QuoteInput, WalletConnection } from '@/types/checkout'
import { requestForSession } from './auth'
import { http } from './http'

async function request<T extends { userId: string }>(session: AuthSession, method: 'get' | 'post' | 'delete', path: string, body?: unknown, signal?: AbortSignal, key?: string): Promise<T> {
 return requestForSession(session, signal, async transport => {
  const config = { ...transport, headers: { ...transport.headers, ...(key ? { 'Idempotency-Key': key } : {}) } }
  const { data } = method === 'get' ? await http.get<T>(path, config) : method === 'delete' ? await http.delete<T>(path, config) : await http.post<T>(path, body, config)
  if (data.userId !== session.user.id) throw new CanceledError('Resposta de outro usuário.')
  return data
 })
}
export const getCheckoutWallets = (session: AuthSession, signal?: AbortSignal) => request<{ userId: string; wallets: CheckoutWallet[] }>(session, 'get', '/checkout/wallets', undefined, signal)
export const connectWallet = (session: AuthSession, walletId: string, provider: string) => request<WalletConnection>(session, 'post', '/checkout/connections', { walletId, provider })
export const disconnectWallet = (session: AuthSession, id: string) => request<WalletConnection>(session, 'delete', `/checkout/connections/${encodeURIComponent(id)}`)
export const getQuote = (session: AuthSession, input: QuoteInput, signal?: AbortSignal) => request<Quote>(session, 'post', '/checkout/quote', input, signal)
export const createPurchase = (session: AuthSession, attempt: PurchaseAttempt) => request<Order>(session, 'post', '/orders', attempt.input, undefined, attempt.key)
export const getOrder = (session: AuthSession, id: string, signal?: AbortSignal) => request<Order>(session, 'get', `/orders/${encodeURIComponent(id)}`, undefined, signal)
export const getOrders = (session: AuthSession, signal?: AbortSignal) => request<{ userId: string; orders: Order[] }>(session, 'get', '/orders', undefined, signal)
const attemptKey = (userId: string) => `kurio:purchase-attempt:${userId}`
/** Only technical attempt metadata is persisted; receipts and credentials are never copied here. */
export function readAttempt(userId: string): PurchaseAttempt | null {
 try { const value = JSON.parse(localStorage.getItem(attemptKey(userId)) || 'null') as PurchaseAttempt | null; return value && typeof value.key === 'string' && typeof value.input?.quoteId === 'string' && typeof value.input.connectionId === 'string' && Number.isSafeInteger(value.input.quoteVersion) ? value : null } catch { return null }
}
export const saveAttempt = (userId: string, attempt: PurchaseAttempt) => localStorage.setItem(attemptKey(userId), JSON.stringify(attempt))
export const clearAttempt = (userId: string) => localStorage.removeItem(attemptKey(userId))
export const newAttempt = (input: OrderInput): PurchaseAttempt => ({ key: crypto.randomUUID(), input })
