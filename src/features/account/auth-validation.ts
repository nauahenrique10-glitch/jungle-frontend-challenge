import type { AuthErrors, RegisterInput } from '@/types/auth'

export function validateAuth(values: Partial<RegisterInput>, signup: boolean): AuthErrors {
 const errors: AuthErrors = {}
 if (signup && !/^[a-zA-Z0-9_-]{3,24}$/.test(values.username?.trim() ?? '')) errors.username = 'Use de 3 a 24 letras, números, _ ou -.'
 if (!values.email || values.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Informe um e-mail válido.'
 if (!values.password || values.password.length > 128 || signup && values.password.length < 8) errors.password = signup ? 'Use uma senha de 8 a 128 caracteres.' : 'Informe sua senha (até 128 caracteres).'
 if (signup && (!values.confirmPassword || values.confirmPassword !== values.password)) errors.confirmPassword = 'As senhas devem ser iguais.'
 return errors
}
const destinations = new Set(['/', '/perfil', '/carteiras', '/favoritos', '/carrinho', '/pagamento', '/confirmacao'])
export function safeAuthDestination(raw: unknown): string {
 if (typeof raw !== 'string' || raw.length > 2048 || !raw.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u001f]/.test(raw)) return '/perfil'
 try {
  const url = new URL(raw, 'https://kurio.invalid')
  if (url.origin !== 'https://kurio.invalid' || !destinations.has(url.pathname) && !/^\/nfts\/[a-z0-9-]+$/.test(url.pathname)) return '/perfil'
  return `${url.pathname}${url.search}${url.hash}`
 } catch { return '/perfil' }
}
export interface AuthSearch { redirect?: string; reason?: 'expired' | 'required' | 'unavailable' }
export function normalizeAuthSearch(raw: Record<string, unknown>): AuthSearch {
 return { redirect: raw.redirect ? safeAuthDestination(raw.redirect) : undefined, reason: raw.reason === 'expired' || raw.reason === 'required' || raw.reason === 'unavailable' ? raw.reason : undefined }
}
