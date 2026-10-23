import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { getNftDetail } from '@/services/nft-detail'

export const nftDetailKeys = { all: ['nft-detail'] as const, detail: (id: string) => ['nft-detail', id] as const }
export function useNftDetail(id: string) {
 return useQuery({
  queryKey: nftDetailKeys.detail(id), queryFn: ({ signal }) => getNftDetail(id, signal),
  staleTime: 30_000, gcTime: 5 * 60_000,
  retry: (failures, error) => failures < 1 && isAxiosError(error) && (!error.response || error.response.status >= 500),
  retryDelay: 300,
 })
}
