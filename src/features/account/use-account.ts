import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { queryClient } from '@/app/query-client'
import { authGeneration, currentSession, privateKeys, sessionKey } from '@/services/auth'
import { getAccountWallets } from '@/services/account'
import type { AuthSession, PrivateProfileResponse, SessionState } from '@/types/auth'
import type { AccountError, AccountErrors, WalletsResponse } from '@/types/account'

export const accountWalletKey = (session: AuthSession) => [...privateKeys.resource(session, 'wallets'), 'account'] as const
export const useAccountWallets = (session: AuthSession) => useQuery({ queryKey: accountWalletKey(session), queryFn: ({ signal }) => getAccountWallets(session, signal), retry: false, gcTime: 0 })
export async function acceptProfile(session: AuthSession, result: PrivateProfileResponse) {
 const stamp = authGeneration()
 if (currentSession()?.id !== session.id || result.profile.id !== session.user.id) return
 await queryClient.cancelQueries({ queryKey: privateKeys.resource(session, 'profile'), exact: true })
 if (currentSession()?.id !== session.id || stamp !== authGeneration()) return
 queryClient.setQueryData(privateKeys.resource(session, 'profile'), result)
 queryClient.setQueryData<SessionState>(sessionKey, previous => previous?.session?.id === session.id ? { ...previous, session: { ...previous.session, user: result.profile } } : previous)
}
export async function acceptWallets(session: AuthSession, result: WalletsResponse) {
 const stamp = authGeneration()
 if (currentSession()?.id !== session.id || stamp !== authGeneration()) return
 await queryClient.cancelQueries({ queryKey: privateKeys.resource(session, 'wallets') })
 if (currentSession()?.id !== session.id) return
 queryClient.setQueryData(accountWalletKey(session), result)
 // Checkout reads the same persisted wallets. Quotes/connections must be reviewed again.
 await queryClient.invalidateQueries({ queryKey: privateKeys.resource(session, 'wallets'), exact: true })
 await queryClient.invalidateQueries({ queryKey: privateKeys.resource(session, 'quote') })
}
export function useAccountMutation<T, R>(session: AuthSession, name: string, run: (input: T) => Promise<R>, success: (result: R) => void | Promise<void>) {
 const lock = useRef(false)
 const stamp = authGeneration()
 const valid = () => currentSession()?.id === session.id && stamp === authGeneration()
 const [fields, setFields] = useState<AccountErrors>({})
 const [error, setError] = useState('')
 const [message, setMessage] = useState('')
 const mutation = useMutation({ mutationKey: ['account', session.user.id, session.id, stamp, name], mutationFn: run, retry: false, gcTime: 0, meta: { private: true } })
 return { fields, error, message, pending: mutation.isPending,
  clear: () => { setFields({}); setError(''); setMessage('') },
  validation: (errors: AccountErrors) => { setFields(errors); setError('Confira os campos indicados.'); setMessage('') },
  execute: async (input: T) => {
   if (lock.current || !valid()) return false
   lock.current = true; setFields({}); setError(''); setMessage('')
   try {
    const result = await mutation.mutateAsync(input)
    if (!valid()) return false
    await success(result)
    if (!valid()) return false
    setMessage('Alterações salvas com sucesso.')
    return true
   } catch (cause) {
    if (!valid()) return false
    const body = isAxiosError<AccountError>(cause) ? cause.response?.data : undefined
    setFields(body?.fields ?? {})
    setError(body?.message ?? 'Não foi possível salvar. Tente novamente.')
    return false
   } finally { lock.current = false; mutation.reset() }
  },
 }
}
