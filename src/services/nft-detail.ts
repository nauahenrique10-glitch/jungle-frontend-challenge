import { http } from './http'
import type { NftDetail } from '@/types/nft-detail'

export async function getNftDetail(id: string, signal?: AbortSignal): Promise<NftDetail> {
 const { data } = await http.get<NftDetail>(`/nfts/${encodeURIComponent(id)}`, { signal })
 return data
}
