import { ws, http, HttpResponse } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { withAuthDatabase } from './auth-store'
import { current } from './auth-handlers'
import { checkout, readOrder } from './checkout-store'
import type { AuthSession } from '@/types/auth'
import type { NftUpdate, OrderUpdate, Subscription } from '@/types/realtime'
import { catalogFixtures } from './catalog-fixtures'
import { updateMarket } from './market-store'

const url = new URL(import.meta.env.VITE_SOCKET_URL || location.origin)
url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
url.pathname = '/kurio-socket/'
const link = ws.link(url.href)
interface Peer { session: AuthSession | null; token: string | null; ready: boolean; send: (name: string, data: unknown) => void; close: () => void }
const peers = new Set<Peer>()
const mode = () => localStorage.getItem('kurio:realtime-scenario') || 'success'
const authentication = (token: string) => new Request(`${location.origin}/api/auth/session`, { headers: { Authorization: `Bearer ${token}` } })
async function authorized(peer: Peer) {
 if (!peer.token) return !peer.session
 return withAuthDatabase(async db => { const identity = await current(db, authentication(peer.token!)); return !identity.failure && identity.session!.id === peer.session?.id && identity.session!.user.id === peer.session?.user.id })
}
async function sendPrivate(peer: Peer, event: OrderUpdate) {
 if (!peers.has(peer) || !peer.ready || !peer.session || !await authorized(peer)) return
 if (!peers.has(peer) || !peer.ready) return
 if (event.userId === peer.session.user.id && event.sessionId === peer.session.id) peer.send('order.updated', event)
}
function orderEvent(peer: Peer, order: OrderUpdate['payload']): OrderUpdate {
 return { eventId: crypto.randomUUID(), resourceId: order.id, version: order.version, updatedAt: order.resolvedAt ?? order.createdAt, userId: order.userId, sessionId: peer.session!.id, payload: order }
}
export const realtimeHandlers = [http.post(`${(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')}/__scenarios/realtime`, async ({ request }) => {
 try {
  const body = await request.json() as { command: string; args?: unknown[] }
  if (body.command === 'diagnostics') return HttpResponse.json(realtimeMock.diagnostics())
  if (body.command === 'disconnect') realtimeMock.disconnect()
  else if (body.command === 'nft') await realtimeMock.nft(...body.args as Parameters<typeof realtimeMock.nft>)
  else if (body.command === 'order') await realtimeMock.order(...body.args as Parameters<typeof realtimeMock.order>)
  else return HttpResponse.json({ message: 'Cenário desconhecido.' }, { status: 422 })
  return HttpResponse.json({ ok: true })
 } catch { return HttpResponse.json({ message: 'Parâmetros de cenário inválidos.' }, { status: 422 }) }
}), link.addEventListener('connection', connection => {
 const bound = toSocketIo(connection)
 const peer: Peer = { session: null, token: null, ready: false, send: (name, data) => bound.client.emit(name, data), close: () => connection.client.close(1012, 'Simulated transport interruption') }
 peers.add(peer)
 let busy = false
 const process = async () => {
  if (busy || !peer.ready || !peers.has(peer)) return
  busy = true
  try {
   if (mode() === 'connection-error' || mode() === 'disconnected') { peer.close(); return }
   if (!await authorized(peer)) { peer.send('session.expired', null); peer.close(); return }
   if (!peer.session) return
   if (['pending', 'error500', 'offline', 'timeout'].includes(localStorage.getItem('kurio:checkout-scenario') || 'success')) return
   // Payment transitions are committed by the mock, not by the application timer.
   const orders = await withAuthDatabase(db => Object.values(checkout(db).orders).filter(record => record.order.userId === peer.session!.user.id && record.order.status === 'pending').flatMap(record => {
    const order = readOrder(db, peer.session!.user.id, record.order.id, localStorage.getItem('kurio:checkout-scenario') || 'success')
    return order.status === 'pending' ? [] : [order]
   }))
   for (const order of orders) await sendPrivate(peer, orderEvent(peer, order))
  } finally { busy = false }
 }
 bound.client.on('session.subscribe', async (_event, input: Subscription) => {
  peer.ready = false
  peer.session = null
  if (!input || input.token !== null && typeof input.token !== 'string') { peer.close(); return }
  peer.token = input.token
  if (input.token) {
   const identity = await withAuthDatabase(db => current(db, authentication(input.token!)))
   if (identity.failure || !peers.has(peer)) { peer.send('session.expired', null); peer.close(); return }
   peer.session = identity.session!
  }
  if (mode() === 'connection-error' || mode() === 'disconnected') { peer.close(); return }
  peer.ready = true
  peer.send('session.ready', { userId: peer.session?.user.id ?? null, sessionId: peer.session?.id ?? null })
  void process()
 })
 // Binding supplies handshake/codec. Engine.IO heartbeats keep long-lived demo connections alive.
 const heartbeat = window.setInterval(() => { if (peers.has(peer)) connection.client.send('2') }, 10_000)
 const timer = window.setInterval(() => { void process().catch(() => peer.close()) }, 350)
 connection.client.addEventListener('close', () => { peers.delete(peer); clearInterval(timer); clearInterval(heartbeat) })
})]

/** Deterministic mock driver. Only emits encoded protocol frames through MSW's socket connection. */
export const realtimeMock = {
 diagnostics: () => ({ connections: peers.size, subscriptions: [...peers].filter(peer => peer.ready).length, users: [...peers].filter(peer => peer.ready).map(peer => peer.session?.user.id ?? null) }),
 disconnect: () => { for (const peer of peers) peer.close() },
 nft: async (id = 'emerald-ape-042', priceEth = '1.29', delivery: 'normal' | 'duplicate' | 'old' | 'out-of-order' | 'lost' = 'normal') => {
  const seed = catalogFixtures.find(nft => nft.id === id)
  if (!seed) throw new Error('NFT não encontrado.')
  const older = delivery === 'out-of-order' ? await withAuthDatabase(db => updateMarket(db, seed, '0.99')) : null
  const event = await withAuthDatabase(db => updateMarket(db, seed, priceEth))
  if (delivery === 'lost') return event
  for (const peer of peers) if (peer.ready) {
   peer.send('nft.updated', event)
   if (delivery === 'duplicate') peer.send('nft.updated', event)
   if (older) peer.send('nft.updated', older)
   else if (delivery === 'old') peer.send('nft.updated', { ...event, eventId: crypto.randomUUID(), version: event.version - 1, payload: { ...event.payload, priceEth: '0.01' } })
  }
  return event
 },
 order: async (id: string, outcome: 'confirmed' | 'refused', delivery: 'normal' | 'duplicate' | 'old' | 'foreign' | 'old-session' | 'lost' = 'normal') => {
  const order = await withAuthDatabase(db => {
   const record = checkout(db).orders[id]
   if (!record) throw new Error('Pedido não encontrado.')
   if (delivery === 'foreign' || delivery === 'old-session') return { ...structuredClone(record.order), status: outcome, version: record.order.version + 1 }
   if (record.order.status === 'pending') { record.outcome = outcome; record.resolveAt = 0 }
   return readOrder(db, record.order.userId, id, 'success')
  })
  if (delivery === 'lost') return order
  for (const peer of peers) if (peer.ready && peer.session) {
   const event = orderEvent(peer, order)
   if (delivery === 'foreign') { peer.send('order.updated', { ...event, userId: 'user-foreign', payload: { ...order, userId: 'user-foreign' } }); continue }
   if (delivery === 'old-session') { peer.send('order.updated', { ...event, sessionId: 'previous-session' }); continue }
   await sendPrivate(peer, event)
   if (delivery === 'duplicate') await sendPrivate(peer, event)
   if (delivery === 'old') await sendPrivate(peer, { ...event, eventId: crypto.randomUUID(), version: 1, payload: { ...order, version: 1, status: 'pending' } })
  }
  return order
 },
}
