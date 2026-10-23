export interface AuthUser {
 id: string
 email: string
 username: string
 displayName: string
 ens: string | null
 walletNickname: string | null
 avatarUrl: string | null
}
export interface AuthSession { id: string; user: AuthUser; expiresAt: string }
export interface SessionState {
 session: AuthSession | null
 reason?: 'expired' | 'logout'
 logoutError?: string
}
export interface AuthResult { session: AuthSession; token: string }
export interface LoginInput { email: string; password: string }
export interface RegisterInput extends LoginInput { username: string; confirmPassword: string }
export type AuthField = keyof RegisterInput
export type AuthErrors = Partial<Record<AuthField, string>>
export interface AuthApiError { code: string; message: string; fields?: AuthErrors }
export interface PrivateProfileResponse { userId: string; sessionId: string; profile: AuthUser }
