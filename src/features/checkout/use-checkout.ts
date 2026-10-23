import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { queryClient } from '@/app/query-client'
import { privateKeys, authGeneration, currentSession } from '@/services/auth'
import { createPurchase, getCheckoutWallets, getOrder, getOrders, getQuote } from '@/services/checkout'
import type { AuthSession } from '@/types/auth'
import type { Order, PurchaseAttempt, QuoteInput } from '@/types/checkout'
import { useRealtime } from '@/app/realtime-lifecycle'

export const checkoutKey = (session: AuthSession, resource: 'wallets' | 'orders' | 'order' | 'quote', id?: string) => [...privateKeys.resource(session, resource), ...(id ? [id] : [])]
export function useCheckoutWallets(session: AuthSession) {
 return useQuery({ queryKey: checkoutKey(session, 'wallets'), queryFn: ({ signal }) => getCheckoutWallets(session, signal), retry: false })
}
export function useOrders(session: AuthSession) {
 return useQuery({ queryKey: checkoutKey(session, 'orders'), queryFn: ({ signal }) => getOrders(session, signal), retry: false, staleTime: 0 })
}
export function useOrder(session: AuthSession, id: string) {
 const realtime = useRealtime()
 const key = checkoutKey(session, 'order', id)
 return useQuery({ queryKey: key, queryFn: async ({ signal }) => {
  const result = await getOrder(session, id, signal)
  const old = queryClient.getQueryData<Order>(key)
  return old && (old.version > result.version || old.status !== 'pending') ? old : result
 }, enabled: !!id && currentSession()?.id === session.id, retry: false, gcTime: 0, refetchInterval: query => query.state.status === 'error' || query.state.data?.status !== 'pending' ? false : realtime.status === 'connected' ? 2500 : 750 })
}
/** Ref lock blocks same-tick duplicate submits; auth generation guards callbacks as well as HTTP. */
export function usePrivateMutation<TInput, TOutput>(session: AuthSession, name: string, run: (input: TInput) => Promise<TOutput>, success?: (data: TOutput) => void, failure?: (error: unknown) => void) {
 const busy = useRef(false)
 const stamp = authGeneration()
 const valid = () => stamp === authGeneration() && currentSession()?.id === session.id
 const mutation = useMutation({ mutationKey: ['checkout', session.user.id, session.id, stamp, name], meta: { private: true }, retry: false, gcTime: 0,
  mutationFn: run,
  onSuccess: data => { if (valid()) success?.(data) },
  onError: error => { if (valid()) failure?.(error) },
  onSettled: () => { busy.current = false },
 })
 return { ...mutation, execute: (input: TInput) => { if (busy.current || !valid()) return; busy.current = true; mutation.mutate(input) } }
}
export const useQuoteMutation = (session: AuthSession, success: (data: Awaited<ReturnType<typeof getQuote>>) => void) => usePrivateMutation(session, 'quote', (input: QuoteInput) => getQuote(session, input), data => { queryClient.setQueryData(checkoutKey(session, 'quote', data.quoteId), data); success(data) })
export const useOrderMutation = (session: AuthSession, success: (data: Order) => void, failure: (error: unknown) => void) => usePrivateMutation(session, 'create-order', (attempt: PurchaseAttempt) => createPurchase(session, attempt), success, failure)
