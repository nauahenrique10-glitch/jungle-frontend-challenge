/** ETH permanece string decimal; não converter valores financeiros para Number. */
export type EthAmount = string
export interface Nft { id: string; name: string; imageUrl: string; priceEth: EthAmount; availableQuantity: number; version: number }
export interface ResourceEvent { eventId: string; resourceId: string; version: number }
export interface ServerToClientEvents { 'nft.updated': (event: ResourceEvent) => void; 'order.updated': (event: ResourceEvent) => void }
