import { useEffect, useSyncExternalStore } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { useSession } from '@/features/account/session'
import { authGeneration } from '@/services/auth'
import { realtimeSnapshot, startRealtime, subscribeRealtime } from '@/services/realtime'
export function RealtimeLifecycle() {
 const snapshot = useRealtime()
 const query = useSession()
 const busy = useIsMutating({ mutationKey: ['auth'] }) > 0
 const generation = authGeneration()
 useEffect(() => {
  if (query.isPending || query.isError || busy) return
  return startRealtime(query.data.session)
 }, [query.data?.session?.id, query.isPending, query.isError, busy, generation])
 return <span className="sr-only" aria-live="polite" aria-atomic="true">{snapshot.announcement}</span>
}
export const useRealtime = () => useSyncExternalStore(subscribeRealtime, realtimeSnapshot)
