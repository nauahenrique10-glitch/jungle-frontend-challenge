
import { io, type Socket } from 'socket.io-client'
import { queryClient } from '@/app/query-client'
import { authGeneration, currentSession, expireCurrentSession, onPrivateCleanup, socketCredential } from './auth'
import type { AuthSession } from '@/types/auth'
import type { NftUpdate, OrderUpdate, RealtimeStatus, ServerEvents, ClientEvents } from '@/types/realtime'
import type { Order } from '@/types/checkout'
import { toWei } from './eth'

let state = { status: 'disconnected' as RealtimeStatus, revision: 0, announcement: '' }
const observers = new Set<() => void>()
const nftVersions = new Map<string, number>()
let active: { stop: () => void; inspect: () => object } | null = null
let diagnostics = { connections: 0, acceptedNfts: 0, acceptedOrders: 0, ignored: 0, reconciliations: 0 }
export const realtimeSnapshot = () => state
export const subscribeRealtime = (listener: () => void) => { observers.add(listener); return () => { observers.delete(listener) } }
export function nftVersion(id: string) {
 let version = nftVersions.get(id) ?? 1
 for (const query of queryClient.getQueryCache().getAll()) {
  const data = query.state.data as { id?: string; version?: number; items?: { id?: string; version?: number; nft?: { id: string; version: number } }[] } | undefined
  if (query.queryKey[0] === 'nft-detail' && data?.id === id) version = Math.max(version, data.version ?? 1)
  for (const item of data?.items ?? []) { if (item.id === id) version = Math.max(version, item.version ?? 1); if (item.nft?.id === id) version = Math.max(version, item.nft.version) }
 }
 return version
}
export const realtimeDiagnostics = () => ({ ...diagnostics, active: !!active, ...(active?.inspect() ?? { nftListeners: 0, orderListeners: 0 }), status: state.status })
const publish = (status = state.status, announcement = '') => { state = { status, revision: state.revision + 1, announcement }; observers.forEach(listener => listener()) }

function validEvent(value: unknown): value is NftUpdate {
 if (!value || typeof value !== 'object') return false
 const event = value as NftUpdate
 return typeof event.eventId === 'string' && typeof event.resourceId === 'string' && Number.isSafeInteger(event.version) && event.version > 0 && typeof event.updatedAt === 'string' && !!event.payload
}
export function startRealtime(session: AuthSession | null) {
 active?.stop()
 const generation = authGeneration()
 const valid = () => !stopped && authGeneration() === generation && (currentSession()?.id ?? null) === (session?.id ?? null)
 let stopped = false
 let subscribed = false
 let hasSubscribed = false
 const seen = new Set<string>()
 const versions = new Map<string, number>()
 const socket: Socket<ServerEvents, ClientEvents> = io(import.meta.env.VITE_SOCKET_URL || location.origin, { path: '/kurio-socket', transports: ['websocket'], autoConnect: false, forceNew: true, reconnectionDelay: 500, reconnectionDelayMax: 2000, randomizationFactor: 0, timeout: 5000 })
 const privateKey = (resource: string, id?: string) => ['private', session!.user.id, session!.id, generation, resource, ...(id ? [id] : [])]
 const affected = (key: readonly unknown[]) => key[0] === 'catalog' || key[0] === 'nft-detail' || key[0] === 'guest' && key.at(-1) === 'cart' || session && key[0] === 'private' && key[1] === session.user.id && key[2] === session.id && ['cart', 'favorites', 'quote', 'orders', 'order'].includes(String(key[4]))
 const reconcile = async () => {
  diagnostics.reconciliations++
  const filter = { predicate: (query: { queryKey: readonly unknown[] }) => !!affected(query.queryKey) }
  await queryClient.cancelQueries(filter)
  if (!valid()) return
  await queryClient.invalidateQueries(filter)
 }
 const accept = (event: NftUpdate, kind: string, minimum: number) => {
  if (!valid() || !subscribed || seen.has(event.eventId) || event.version <= Math.max(minimum, versions.get(`${kind}:${event.resourceId}`) ?? 0)) { diagnostics.ignored++; return false }
  seen.add(event.eventId)
  if (seen.size > 1024) seen.delete(seen.values().next().value!)
  versions.set(`${kind}:${event.resourceId}`, event.version)
  return true
 }
 const nft = (event: NftUpdate) => {
  if (!validEvent(event) || typeof event.payload.priceEth !== 'string' || event.payload.availableQuantity !== null && (!Number.isSafeInteger(event.payload.availableQuantity) || event.payload.availableQuantity < 0)) return
  try { if (toWei(event.payload.priceEth) <= 0n) return } catch { return }
  if (!accept(event, 'nft', nftVersion(event.resourceId))) return
  nftVersions.set(event.resourceId, event.version); diagnostics.acceptedNfts++; publish(state.status, 'Informações do NFT atualizadas. Revise os valores antes de comprar.')
  const filter = { predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[0] === 'catalog' || query.queryKey[0] === 'nft-detail' || ['private', 'guest'].includes(String(query.queryKey[0])) && ['cart', 'favorites', 'quote'].includes(String(query.queryKey[0] === 'private' ? query.queryKey[4] : query.queryKey.at(-1))) }
  void queryClient.cancelQueries(filter).then(() => { if (valid()) return queryClient.invalidateQueries(filter) })
 }
 const order = (event: OrderUpdate) => {
  if (!validEvent(event) || !session || event.userId !== session.user.id || event.sessionId !== session.id || event.payload.userId !== session.user.id || event.payload.user?.id !== session.user.id || event.payload.quote?.userId !== session.user.id || event.payload.id !== event.resourceId || event.payload.version !== event.version || !['pending', 'confirmed', 'refused'].includes(event.payload.status)) { diagnostics.ignored++; return }
  const key = privateKey('order', event.resourceId)
  const old = queryClient.getQueryData<Order>(key)
  if (old?.status !== undefined && old.status !== 'pending') { diagnostics.ignored++; return }
  if (!accept(event as unknown as NftUpdate, 'order', old?.version ?? 0)) return
  diagnostics.acceptedOrders++
  void queryClient.cancelQueries({ queryKey: key, exact: true }).then(() => {
   if (!valid()) return
   const latest = queryClient.getQueryData<Order>(key)
   if (latest && (latest.version >= event.version || latest.status !== 'pending')) return
   queryClient.setQueryData(key, event.payload)
   publish(state.status, 'Estado do pedido atualizado.')
   void queryClient.invalidateQueries({ queryKey: privateKey('orders') })
   if (event.payload.status === 'confirmed') void queryClient.invalidateQueries({ queryKey: privateKey('cart') })
  })
 }
 const connect = () => { if (valid()) { subscribed = false; publish('connecting'); socket.emit('session.subscribe', { token: socketCredential() }) } }
 const ready = (identity: { userId: string | null; sessionId: string | null }) => {
  if (!valid() || identity.userId !== (session?.user.id ?? null) || identity.sessionId !== (session?.id ?? null)) return
  subscribed = true
  // First-load HTTP queries already recover current state. Do not cancel their
  // loading/retry lifecycle. Only an actual reconnect needs full reconciliation.
  const recovery = hasSubscribed ? reconcile() : queryClient.invalidateQueries({ predicate: query => !!affected(query.queryKey) && query.state.status === 'success' && query.state.fetchStatus === 'idle' })
  hasSubscribed = true
  void recovery.then(() => { if (valid() && subscribed && socket.connected) publish('connected') }).catch(() => { if (valid()) publish('error') })
 }
 const disconnect = () => { subscribed = false; if (valid()) publish('disconnected') }
 const error = () => { if (valid()) publish('error') }
 const expired = () => { if (valid() && session) expireCurrentSession(session.id) }
 socket.on('connect', connect); socket.on('session.ready', ready); socket.on('disconnect', disconnect); socket.on('connect_error', error); socket.on('session.expired', expired); socket.on('nft.updated', nft); socket.on('order.updated', order)
 const stop = () => {
  if (stopped) return
  stopped = true; subscribed = false; unregister()
  socket.removeAllListeners(); socket.disconnect()
  if (active?.stop === stop) { active = null; publish('disconnected') }
 }
 const unregister = onPrivateCleanup(stop)
 active = { stop, inspect: () => ({ nftListeners: socket.listeners('nft.updated').length, orderListeners: socket.listeners('order.updated').length }) }; diagnostics.connections++; publish('connecting')
 // StrictMode can clean up an effect in the same commit. Do not open an already-aborted transport.
 queueMicrotask(() => { if (valid()) socket.connect() })
 return stop
}

