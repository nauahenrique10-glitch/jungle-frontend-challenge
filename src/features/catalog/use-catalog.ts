import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { getCatalog } from '@/services/catalog'
import type { CatalogParams } from '@/types/catalog'
import { sameCatalogFilters } from './catalog-params'

export const catalogKeys = {
 all: ['catalog'] as const,
 list: (params: CatalogParams) => ['catalog', 'list', params] as const,
}
export function useCatalog(params: CatalogParams) {
 return useQuery({
  queryKey: catalogKeys.list(params),
  queryFn: ({ signal }) => getCatalog(params, signal),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: (failures, error) => failures < 1 && isAxiosError(error) && (!error.response || error.response.status >= 500),
  retryDelay: 300,
  placeholderData: (previous, previousQuery) => {
   const oldParams = previousQuery?.queryKey[2] as CatalogParams | undefined
   return oldParams && sameCatalogFilters(oldParams, params) ? previous : undefined
  },
 })
}
