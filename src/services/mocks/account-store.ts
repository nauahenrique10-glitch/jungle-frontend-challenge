import type { AuthDatabase } from './auth-store'
import type { AccountWallet, WalletInput } from '@/types/account'
import { CommerceFailure } from './commerce-store'

export interface AccountDatabase { wallets: Record<string, AccountWallet[]>; secondaryUsesPrimary: Record<string, boolean> }
export function account(db: AuthDatabase): AccountDatabase { return db.account ??= { wallets: {}, secondaryUsesPrimary: {} } }
export function accountWallets(db: AuthDatabase, userId: string): AccountWallet[] {
 const state = account(db)
 if (!state.wallets[userId]) {
  const profile = db.users.find(user => user.profile.id === userId)!.profile
  // Existing checkout reference wallets are preserved; their full addresses are unknown.
  state.wallets[userId] = [
   { id: `${userId}:reserve`, label: 'Reserva', displayAddress: 'nova.kurio.eth', address: null, network: 'Polygon', role: 'secondary' },
   { id: `${userId}:primary`, label: 'Principal', displayAddress: '0xA91F…E82C', address: null, network: 'Ethereum', role: 'primary' },
  ].map(wallet => ({ displayName: profile.displayName, username: profile.username, email: profile.email, ens: '', secondaryAddress: '', provider: '', referralCode: '', version: 1, userId, ...wallet }) as AccountWallet)
 }
 return state.wallets[userId]
}
export function saveWallet(db: AuthDatabase, userId: string, input: WalletInput, id?: string): AccountWallet {
 const list = accountWallets(db, userId)
 const existing = id ? list.find(wallet => wallet.id === id) : undefined
 if (id && !existing) throw new CommerceFailure(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada para este usuário.')
 if (list.some(wallet => wallet.id !== id && wallet.network === input.network && wallet.address?.toLowerCase() === input.address.toLowerCase())) throw new CommerceFailure(409, 'WALLET_CONFLICT', 'Este endereço já está cadastrado nesta rede.', { address: 'Endereço já cadastrado nesta rede.' })
 if (existing?.role === 'primary' && input.role !== 'primary') throw new CommerceFailure(400, 'PRIMARY_REQUIRED', 'Defina outra carteira como principal antes de alterar esta prioridade.')
 if (input.role === 'primary') list.forEach(wallet => { if (wallet.id !== id && wallet.role === 'primary') { wallet.role = 'secondary'; wallet.version++ } })
 const result: AccountWallet = { ...input, id: id ?? crypto.randomUUID(), userId, version: (existing?.version ?? 0) + 1, displayAddress: input.address }
 if (existing) list[list.indexOf(existing)] = result
 else list.push(result)
 return result
}
export function promoteWallet(db: AuthDatabase, userId: string, id: string) {
 const list = accountWallets(db, userId)
 const wallet = list.find(item => item.id === id)
 if (!wallet) throw new CommerceFailure(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada para este usuário.')
 list.forEach(item => { const role = item.id === id ? 'primary' : 'secondary'; if (item.role !== role) { item.role = role; item.version++ } })
}
