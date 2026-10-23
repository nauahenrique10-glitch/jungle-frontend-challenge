import { CanceledError } from 'axios'
import { requestForSession } from './auth'
import { http } from './http'
import type { AuthSession, PrivateProfileResponse } from '@/types/auth'
import type { AccountActionResponse, PasswordInput, ProfileInput, WalletInput, WalletsResponse } from '@/types/account'

async function request<T extends { userId: string; sessionId: string }>(session: AuthSession, method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, data?: unknown, signal?: AbortSignal): Promise<T> {
 return requestForSession(session, signal, async context => {
  const result = await http.request<T>({ ...context, method, url: path, data })
  if (result.data.userId !== session.user.id || result.data.sessionId !== session.id) throw new CanceledError('Resposta de outra sessão.')
  return result.data
 })
}
export const updateProfile = (session: AuthSession, input: ProfileInput) => request<PrivateProfileResponse>(session, 'PATCH', '/account/profile', input)
export const changePassword = (session: AuthSession, input: PasswordInput) => request<AccountActionResponse>(session, 'POST', '/account/password', input)
export const changeAvatar = (session: AuthSession, file: File | null) => {
 const data = new FormData()
 if (file) data.append('avatar', file)
 return request<PrivateProfileResponse>(session, file ? 'PUT' : 'DELETE', '/account/avatar', file ? data : undefined)
}
export const getAccountWallets = (session: AuthSession, signal?: AbortSignal) => request<WalletsResponse>(session, 'GET', '/account/wallets', undefined, signal)
export const saveAccountWallet = (session: AuthSession, input: WalletInput, id?: string) => request<WalletsResponse>(session, id ? 'PATCH' : 'POST', `/account/wallets${id ? `/${encodeURIComponent(id)}` : ''}`, input)
export const promoteAccountWallet = (session: AuthSession, id: string) => request<WalletsResponse>(session, 'PATCH', `/account/wallets/${encodeURIComponent(id)}`, { role: 'primary' })
export const setWalletPreference = (session: AuthSession, secondaryUsesPrimary: boolean) => request<WalletsResponse>(session, 'PATCH', '/account/wallet-preferences', { secondaryUsesPrimary })
