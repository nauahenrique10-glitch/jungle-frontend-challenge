import { normalizeCatalogParams } from '@/features/catalog/catalog-params'
import type { NftDetailSearch } from '@/types/nft-detail'

export function normalizeQuantity(raw: unknown, available: number | null = null): number {
 const number = typeof raw === 'number' || typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN
 const max = available === null ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(available)))
 return Number.isSafeInteger(number) && number >= 1 ? Math.min(number, max) : 1
}
export function normalizeDetailSearch(raw: Record<string, unknown>): NftDetailSearch {
 return {
  ...normalizeCatalogParams(raw),
  edition: typeof raw.edition === 'string' && /^[a-z0-9-]{1,40}$/.test(raw.edition) ? raw.edition : '',
  quantity: normalizeQuantity(raw.quantity),
 }
}
