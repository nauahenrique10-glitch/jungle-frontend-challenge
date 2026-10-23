import { useIsMutating, useMutation, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { queryClient } from '@/app/query-client'
import { authGeneration } from '@/services/auth'
import { getGuestCartId } from '@/services/guest-cart'
import { changeCart, commerceKey, favoritesRequest, getCart, isCurrentCommerce, type CartOperation, type CommerceContext } from '@/services/commerce'
import type { CartResponse, CommerceErrorBody, FavoritesResponse } from '@/types/commerce'
import { useSession } from '@/features/account/session'

const locks = new Set<string>()
export function commerceError(error: unknown): string { return isAxiosError<CommerceErrorBody>(error) ? error.response?.data.message ?? 'Falha de conexão. Tente novamente.' : 'Não foi possível concluir. Tente novamente.' }
export function useCommerceContext() {
 const session = useSession()
 const authBusy = useIsMutating({ mutationKey: ['auth'] }) > 0
 const context: CommerceContext | null = session.isPending || session.isError || authBusy ? null : session.data.session ? { kind: 'user', session: session.data.session, generation: authGeneration() } : { kind: 'guest', guestId: getGuestCartId(), generation: authGeneration() }
 return { context, session, authBusy }
}
export function useCart() {
 const identity = useCommerceContext()
 const key = commerceKey(identity.context, 'cart')
 const query = useQuery({ queryKey: key, queryFn: async ({ signal }) => {
  const data = await getCart(identity.context!, signal)
  const cached = queryClient.getQueryData<CartResponse>(key)
  return cached && cached.version > data.version ? cached : data
 }, enabled: !!identity.context && isCurrentCommerce(identity.context), retry: false, gcTime: 0, staleTime: 15_000, refetchOnWindowFocus: false, refetchOnMount: false })
 return { ...query, ...identity, key }
}
export function useCartActions() {
 const { context } = useCommerceContext()
 const key = commerceKey(context, 'cart')
 const scope = JSON.stringify(key)
 const pending = useIsMutating({ mutationKey: ['commerce', 'cart', scope] }) > 0
 const mutation = useMutation({
  mutationKey: ['commerce', 'cart', scope], retry: false, gcTime: 0, meta: { private: true },
  mutationFn: ({ context, operation }: { context: CommerceContext; operation: CartOperation; scope: string }) => changeCart(context, operation),
  onMutate: async variables => { await queryClient.cancelQueries({ queryKey: commerceKey(variables.context, 'cart'), exact: true }) },
  onSuccess: (data, variables) => { if (isCurrentCommerce(variables.context)) queryClient.setQueryData(commerceKey(variables.context, 'cart'), data) },
  onSettled: (_data, _error, variables) => {
   locks.delete(variables.scope)
   if (isCurrentCommerce(variables.context)) void queryClient.invalidateQueries({ queryKey: commerceKey(variables.context, 'cart'), exact: true })
  },
 })
 const current = mutation.variables?.scope === scope
 return {
  ready: !!context && isCurrentCommerce(context),
  pending, error: current && mutation.isError ? mutation.error : null, succeeded: current && mutation.isSuccess,
  reset: mutation.reset,
  execute: (operation: CartOperation) => {
   if (!context || !isCurrentCommerce(context) || locks.has(scope)) return
   locks.add(scope)
   mutation.mutate({ context, operation, scope })
  },
 }
}
export function useFavorites(enabled = true) {
 const { context, session, authBusy } = useCommerceContext()
 const key = commerceKey(context, 'favorites')
 const scope = JSON.stringify(key)
 const query = useQuery({ queryKey: key, queryFn: ({ signal }) => favoritesRequest(context!, signal), enabled: enabled && context?.kind === 'user' && isCurrentCommerce(context), retry: false, gcTime: 0, staleTime: 15_000, refetchOnMount: false, refetchOnWindowFocus: false })
 const pending = useIsMutating({ mutationKey: ['commerce', 'favorites', scope] }) > 0
 const mutation = useMutation({
  mutationKey: ['commerce', 'favorites', scope], retry: false, gcTime: 0, meta: { private: true },
  mutationFn: ({ context, nftId, saved }: { context: CommerceContext; nftId: string; saved: boolean; scope: string }) => favoritesRequest(context, undefined, { nftId, saved }),
  onMutate: async variables => {
   const target = commerceKey(variables.context, 'favorites')
   await queryClient.cancelQueries({ queryKey: target, exact: true })
   const previous = queryClient.getQueryData<FavoritesResponse>(target)
   if (previous && isCurrentCommerce(variables.context)) queryClient.setQueryData<FavoritesResponse>(target, { ...previous, nftIds: variables.saved ? [...previous.nftIds, variables.nftId] : previous.nftIds.filter(id => id !== variables.nftId) })
   return previous
  },
  onError: (_error, variables, previous) => { if (previous && isCurrentCommerce(variables.context) && queryClient.getQueryState(commerceKey(variables.context, 'favorites'))) queryClient.setQueryData(commerceKey(variables.context, 'favorites'), previous) },
  onSuccess: (data, variables) => { if (isCurrentCommerce(variables.context)) queryClient.setQueryData(commerceKey(variables.context, 'favorites'), data) },
  onSettled: (_data, _error, variables) => {
   locks.delete(variables.scope)
   if (isCurrentCommerce(variables.context)) void queryClient.invalidateQueries({ queryKey: commerceKey(variables.context, 'favorites'), exact: true })
  },
 })
 return { ...query, context, session, authBusy, pending, mutationError: mutation.variables?.scope === scope && mutation.isError ? mutation.error : null,
  toggle: (nftId: string) => {
   if (context?.kind !== 'user' || !query.data || !isCurrentCommerce(context) || locks.has(scope)) return
   locks.add(scope)
   mutation.mutate({ context, nftId, saved: !query.data.nftIds.includes(nftId), scope })
  },
 }
}
