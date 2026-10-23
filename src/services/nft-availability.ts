import type { NftDetail } from '@/types/nft-detail'
export function editionAvailability(nft: NftDetail, edition: string | null): number | null {
 const option = nft.editions.find(item => item.id === edition)
 if (option?.available === false) return 0
 const known = [nft.availableQuantity, option?.availableQuantity].filter((value): value is number => typeof value === 'number')
 return known.length ? Math.min(...known) : null
}
