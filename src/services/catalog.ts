import { http } from './http'
import type { CatalogParams, CatalogResponse } from '@/types/catalog'

export async function getCatalog(params: CatalogParams, signal?: AbortSignal): Promise<CatalogResponse> {
 const response = await http.get<CatalogResponse>('/nfts', { params, signal })
 return response.data
}
