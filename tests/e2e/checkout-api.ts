import { http } from '@/services/http'
import { currentSession, requestForSession } from '@/services/auth'
import { queryClient } from '@/app/query-client'
import { checkoutKey } from '@/features/checkout/use-checkout'
import { isAxiosError } from 'axios'
import type { Quote } from '@/types/checkout'

export async function run(operation: string, body?: unknown) {
 const session = currentSession()!
 return requestForSession(session, undefined, async transport => {
  try {
   const input = body as { key?: string; input?: unknown; id?: string } | undefined
   const result = operation === 'orders' ? await http.get('/orders', transport)
    : operation === 'order' ? await http.get(`/orders/${input!.id}`, transport)
    : operation === 'create' ? await http.post('/orders', input!.input, { ...transport, headers: { ...transport.headers, 'Idempotency-Key': input!.key! } })
    : operation === 'cart' ? await http.get('/cart', transport)
    : operation === 'quote-data' ? { data: queryClient.getQueryCache().findAll({ queryKey: checkoutKey(session, 'quote') }).at(-1)?.state.data as Quote }
    : await http.post('/checkout/quote', body, transport)
   return { status: 200, data: result.data }
  } catch (error) { if (isAxiosError(error)) return { status: error.response?.status ?? 0, data: error.response?.data }; throw error }
 })
}

