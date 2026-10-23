import { delay, http, HttpResponse } from 'msw'
import { current } from './auth-handlers'
import { withAuthDatabase, type AuthDatabase } from './auth-store'
import type { AuthSession } from '@/types/auth'
import type { OrderInput, QuoteInput, WalletConnection } from '@/types/checkout'
import { checkout, createOrder, makeQuote, readOrder, walletFor, wallets } from './checkout-store'
import { CommerceFailure } from './commerce-store'

const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
export const checkoutScenarios = ['success', 'latency', 'price-changed', 'fee-changed', 'coupon-expired', 'error500', 'timeout', 'offline', 'wallet-refused', 'wallet-error', 'payment-refused', 'pending', 'commit-timeout'] as const
const scenario = () => localStorage.getItem('kurio:checkout-scenario') || 'success'
type Result = { value: object; status?: number; committed?: boolean }
async function handle(request: Request, action: (db: AuthDatabase, session: AuthSession, body: Record<string, unknown>, configured: string) => Result | Promise<Result>) {
 const configured = scenario()
 await delay(configured === 'latency' ? 1200 : 100)
 if (configured === 'offline') return HttpResponse.error()
 if (configured === 'timeout') { await delay(16_000); return HttpResponse.json({ code: 'TIMEOUT', message: 'Tempo de resposta excedido.' }, { status: 504 }) }
 if (configured === 'error500') return HttpResponse.json({ code: 'CHECKOUT_UNAVAILABLE', message: 'Simulador indisponível. Tente novamente.' }, { status: 500 })
 let body: Record<string, unknown> = {}
 if (request.method === 'POST') {
  try { const parsed = await request.json(); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); body = parsed }
  catch { return HttpResponse.json({ code: 'INVALID_BODY', message: 'Dados inválidos.' }, { status: 422 }) }
 }
 const result = await withAuthDatabase(async db => {
  const identity = await current(db, request)
  if (identity.failure) return { response: identity.failure }
  try { return await action(db, identity.session!, body, configured) }
  catch (error) {
   if (error instanceof CommerceFailure) return { value: { code: error.code, message: error.message, fields: error.fields }, status: error.status }
   throw error
  }
 })
 if ('response' in result) return result.response
 // Commit completes BEFORE losing transport. A retry with the same key retrieves that record.
 if (result.committed && configured === 'commit-timeout') { await delay(16_000); return HttpResponse.error() }
 return HttpResponse.json(result.value, { status: result.status ?? 200 })
}
export const checkoutHandlers = [
 http.get(`${base}/checkout/wallets`, ({ request }) => handle(request, (db, session) => ({ value: { userId: session.user.id, wallets: wallets(db, session.user.id) } }))),
 http.post(`${base}/checkout/connections`, ({ request }) => handle(request, (db, session, body, configured) => {
  if (configured === 'wallet-refused') throw new CommerceFailure(409, 'CONNECTION_REFUSED', 'Conexão recusada pelo usuário na simulação.')
  if (configured === 'wallet-error') throw new CommerceFailure(503, 'CONNECTION_FAILED', 'Não foi possível conectar a carteira simulada.')
  const wallet = walletFor(db, session.user.id, body.walletId)
  if (!['WalletConnect', 'MetaMask', 'Coinbase Wallet'].includes(String(body.provider))) throw new CommerceFailure(422, 'INVALID_PROVIDER', 'Selecione um provedor disponível.')
  const connection: WalletConnection = { id: crypto.randomUUID(), userId: session.user.id, wallet, provider: String(body.provider), connected: true }
  checkout(db).connections[connection.id] = { ...connection, sessionId: session.id }
  return { value: connection }
 })),
 http.delete(`${base}/checkout/connections/:id`, ({ request, params }) => handle(request, (db, session) => {
  const connection = checkout(db).connections[String(params.id)]
  if (!connection || connection.userId !== session.user.id || connection.sessionId !== session.id) throw new CommerceFailure(404, 'CONNECTION_NOT_FOUND', 'Conexão não encontrada.')
  connection.connected = false
  return { value: connection }
 })),
 http.post(`${base}/checkout/quote`, ({ request }) => handle(request, (db, session, body) => ({ value: makeQuote(db, session.user.id, body as unknown as QuoteInput) }))),
 http.post(`${base}/orders`, ({ request }) => handle(request, (db, session, body, configured) => {
  const key = request.headers.get('Idempotency-Key')
  if (!key || key.length > 200) throw new CommerceFailure(422, 'IDEMPOTENCY_REQUIRED', 'Informe uma chave de tentativa válida.')
  if (typeof body.quoteId !== 'string' || !Number.isSafeInteger(body.quoteVersion) || typeof body.connectionId !== 'string') throw new CommerceFailure(422, 'INVALID_ORDER', 'Dados do pedido inválidos.')
  const already = Object.values(checkout(db).orders).some(record => record.key === key && record.order.userId === session.user.id)
  const result = createOrder(db, session, body as unknown as OrderInput, key, configured)
  if ('changed' in result) return { value: { code: 'QUOTE_CHANGED', message: 'Os valores ou condições mudaram. Revise e confirme novamente.', quote: result.changed }, status: 409 }
  return { value: result, committed: !already }
 })),
 http.get(`${base}/orders`, ({ request }) => handle(request, (db, session, _body, configured) => ({ value: { userId: session.user.id, orders: Object.values(checkout(db).orders).filter(record => record.order.userId === session.user.id).map(record => readOrder(db, session.user.id, record.order.id, configured)) } }))),
 http.get(`${base}/orders/:id`, ({ request, params }) => handle(request, (db, session, _body, configured) => ({ value: readOrder(db, session.user.id, String(params.id), configured) }))),
]
