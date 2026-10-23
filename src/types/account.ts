import type { AuthUser } from './auth'

export type ProfileInput = Pick<AuthUser, 'displayName' | 'username' | 'email' | 'ens' | 'walletNickname'>
export interface PasswordInput { currentPassword: string; newPassword: string; confirmPassword: string }
export type AccountErrors = Record<string, string>
export interface AccountError { code: string; message: string; fields?: AccountErrors }
export type WalletNetwork = 'Ethereum' | 'Polygon'
export type WalletRole = 'primary' | 'secondary'
export interface WalletInput {
 displayName: string; label: string; network: WalletNetwork | ''; username: string;
 address: string; secondaryAddress: string; provider: string; referralCode: string;
 email: string; ens: string; role: WalletRole;
}
export interface AccountWallet extends Omit<WalletInput, 'address'> {
 id: string; userId: string; address: string | null; displayAddress: string; version: number;
}
export interface WalletsResponse { userId: string; sessionId: string; wallets: AccountWallet[]; secondaryUsesPrimary: boolean }
export interface AccountActionResponse { userId: string; sessionId: string; message: string }
export const avatarMaxBytes = 512 * 1024
export const avatarTypes = ['image/png', 'image/jpeg', 'image/webp'] as const
