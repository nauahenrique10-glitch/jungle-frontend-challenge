import type { AuthUser } from '@/types/auth'
import type { CommerceDatabase } from './commerce-store'
import type { CheckoutDatabase } from './checkout-store'
import type { MarketDatabase } from './market-store'
import type { AccountDatabase } from './account-store'

interface MockUser { profile: AuthUser; salt: string; verifier: string }
interface MockSession { id: string; tokenHash: string; userId: string; expiresAt: number }
export interface AuthDatabase { version: 1; users: MockUser[]; sessions: MockSession[]; commerce?: CommerceDatabase; checkout?: CheckoutDatabase; market?: MarketDatabase; account?: AccountDatabase }
export const authDatabaseKey = 'kurio:mock-auth-db:v1'
const seeds: MockUser[] = [
 { profile: { id: 'user-alice', email: 'alice@kurio.test', username: 'alicekurio', displayName: 'Alice Colecionadora', ens: null, walletNickname: null, avatarUrl: null }, salt: 'alice-kurio-demo-v1', verifier: '5f700c64516af7f842855701fa59773d1cea93e1691f7a81e4e0aa6ba83dfd37' },
 { profile: { id: 'user-bruno', email: 'bruno@kurio.test', username: 'brunokurio', displayName: 'Bruno Colecionador', ens: null, walletNickname: null, avatarUrl: null }, salt: 'bruno-kurio-demo-v1', verifier: 'a181cea606905927f859d9ce8960211a35b291fd8cc37f044d6b3ff6dcd7e81b' },
]
const hex = (value: ArrayBuffer) => [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('')
export async function passwordVerifier(password: string, salt: string): Promise<string> {
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
 return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 600_000 }, key, 256))
}
export async function tokenHash(token: string) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))) }
let queue: Promise<unknown> = Promise.resolve()
export async function withAuthDatabase<T>(run: (db: AuthDatabase) => T | Promise<T>): Promise<T> {
 const task = async () => {
  let db: AuthDatabase
  try {
   const saved = JSON.parse(localStorage.getItem(authDatabaseKey) || 'null') as AuthDatabase | null
   db = saved?.version === 1 && Array.isArray(saved.users) && Array.isArray(saved.sessions) ? saved : { version: 1, users: structuredClone(seeds), sessions: [] }
  } catch { db = { version: 1, users: structuredClone(seeds), sessions: [] } }
  const result = await run(db)
  localStorage.setItem(authDatabaseKey, JSON.stringify(db))
  return result
 }
 if (navigator.locks) return await navigator.locks.request('kurio:mock-auth-db', task)
 const result = queue.then(task, task)
 queue = result.then(() => undefined, () => undefined)
 return result
}
