import type { Order } from './checkout'
export interface NftUpdate { eventId: string; resourceId: string; version: number; updatedAt: string; payload: { priceEth: string; availableQuantity: number | null } }
export interface OrderUpdate { eventId: string; resourceId: string; version: number; updatedAt: string; userId: string; sessionId: string; payload: Order }
export interface Subscription { token: string | null }
export interface SubscriptionReady { userId: string | null; sessionId: string | null }
export interface ServerEvents { 'nft.updated': (event: NftUpdate) => void; 'order.updated': (event: OrderUpdate) => void; 'session.ready': (identity: SubscriptionReady) => void; 'session.expired': () => void }
export interface ClientEvents { 'session.subscribe': (identity: Subscription) => void }
export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
