import { delay, http, HttpResponse } from 'msw'
import { current } from './auth-handlers'
import { passwordVerifier, withAuthDatabase, type AuthDatabase } from './auth-store'
import { account, accountWallets, promoteWallet, saveWallet } from './account-store'
import { CommerceFailure } from './commerce-store'
import { validateAvatar, validatePassword, validateProfile, validateWallet } from '@/features/account/account-validation'
import type { AuthSession } from '@/types/auth'
import type { PasswordInput, ProfileInput, WalletInput } from '@/types/account'

const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const scenario = () => localStorage.getItem('kurio:account-scenario') || 'success'
type Action = (db: AuthDatabase, session: AuthSession) => Promise<object> | object
const fail = (status: number, code: string, message: string, fields?: Record<string, string>) => HttpResponse.json({ code, message, fields }, { status })
async function handle(request: Request, action: Action, status = 200) {
 const mode = scenario()
 await delay(mode === 'latency' ? 1400 : 100)
 if (mode === 'offline') return HttpResponse.error()
 try {
  return await withAuthDatabase(async db => {
   const identity = await current(db, request)
   if (identity.failure) return identity.failure
   if (mode === 'unauthorized') { db.sessions.find(item => item.id === identity.session!.id)!.expiresAt = Date.now(); return fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.') }
   if (mode === 'error500') return fail(500, 'ACCOUNT_UNAVAILABLE', 'Serviço de conta temporariamente indisponível.')
   if (mode === 'validation') return fail(400, 'VALIDATION_ERROR', 'Confira os campos indicados.', { displayName: 'Nome recusado pelo simulador.' })
   const result = await action(db, identity.session!)
   if (result instanceof Response) return result
   return HttpResponse.json({ userId: identity.session!.user.id, sessionId: identity.session!.id, ...result }, { status })
  })
 } catch (error) {
  if (error instanceof CommerceFailure) return fail(error.status, error.code, error.message, error.fields)
  return fail(500, 'ACCOUNT_STORAGE_ERROR', 'Não foi possível salvar os dados locais. Verifique o espaço disponível e tente novamente.')
 }
}
async function json(request: Request): Promise<Record<string, unknown>> {
 try { const body = await request.json(); if (body && typeof body === 'object' && !Array.isArray(body)) return body } catch { /* 400 below */ }
 throw new CommerceFailure(400, 'INVALID_BODY', 'Envie um objeto JSON válido.')
}
function text(body: Record<string, unknown>, key: string, nullable = false) {
 if (nullable && body[key] === null) return ''
 if (typeof body[key] !== 'string') throw new CommerceFailure(400, 'INVALID_FIELD', 'Confira os campos indicados.', { [key]: 'Informe um texto válido.' })
 return body[key] as string
}
function validate(errors: Record<string, string>) { if (Object.keys(errors).length) throw new CommerceFailure(400, 'VALIDATION_ERROR', 'Confira os campos indicados.', errors) }
function view(db: AuthDatabase, userId: string) { return { wallets: structuredClone(accountWallets(db, userId)), secondaryUsesPrimary: account(db).secondaryUsesPrimary[userId] ?? false } }
function walletInput(body: Record<string, unknown>): WalletInput {
 const fields = ['displayName', 'label', 'network', 'username', 'address', 'secondaryAddress', 'provider', 'referralCode', 'email', 'ens', 'role'] as const
 const input = Object.fromEntries(fields.map(key => [key, text(body, key).trim()])) as unknown as WalletInput
 input.email = input.email.toLowerCase(); input.username = input.username.toLowerCase()
 validate(validateWallet(input))
 return input
}
function invalidateConnections(db: AuthDatabase, userId: string) {
 for (const connection of Object.values(db.checkout?.connections ?? {})) if (connection.userId === userId) connection.connected = false
}
export const accountHandlers = [
 http.patch(`${base}/account/profile`, ({ request }) => handle(request, async (db, session) => {
  const body = await json(request)
  const input: ProfileInput = { displayName: text(body, 'displayName').trim(), username: text(body, 'username').trim().toLowerCase(), email: text(body, 'email').trim().toLowerCase(), ens: text(body, 'ens', true).trim() || null, walletNickname: text(body, 'walletNickname', true).trim() || null }
  validate(validateProfile(input))
  const fields: Record<string, string> = {}
  for (const user of db.users) if (user.profile.id !== session.user.id) {
   if (user.profile.email.toLowerCase() === input.email) fields.email = 'Este e-mail já está cadastrado.'
   if (user.profile.username.toLowerCase() === input.username) fields.username = 'Este nome de usuário já está em uso.'
  }
  if (Object.keys(fields).length) throw new CommerceFailure(409, 'PROFILE_CONFLICT', 'E-mail ou username já utilizado.', fields)
  Object.assign(db.users.find(user => user.profile.id === session.user.id)!.profile, input)
  return { profile: session.user }
 })),
 http.post(`${base}/account/password`, ({ request }) => handle(request, async (db, session) => {
  const body = await json(request)
  const input: PasswordInput = { currentPassword: text(body, 'currentPassword'), newPassword: text(body, 'newPassword'), confirmPassword: text(body, 'confirmPassword') }
  validate(validatePassword(input))
  const user = db.users.find(item => item.profile.id === session.user.id)!
  if (await passwordVerifier(input.currentPassword, user.salt) !== user.verifier) throw new CommerceFailure(400, 'INCORRECT_PASSWORD', 'A senha atual está incorreta.', { currentPassword: 'A senha atual está incorreta.' })
  const salt = crypto.randomUUID()
  const verifier = await passwordVerifier(input.newPassword, salt)
  // PBKDF2 can take time. Recheck expiry before committing the new credential.
  const identity = await current(db, request)
  if (identity.failure) return identity.failure
  user.salt = salt; user.verifier = verifier
  db.sessions = db.sessions.filter(item => item.userId !== session.user.id || item.id === session.id)
  return { message: 'Senha alterada com sucesso.' }
 })),
 http.put(`${base}/account/avatar`, ({ request }) => handle(request, async (db, session) => {
  let file: FormDataEntryValue | null = null
  try { file = (await request.formData()).get('avatar') } catch { /* invalid multipart */ }
  if (!(file instanceof File)) throw new CommerceFailure(400, 'INVALID_AVATAR', 'Selecione uma imagem.', { avatar: 'Selecione uma imagem.' })
  const error = validateAvatar(file)
  if (error) throw new CommerceFailure(file.size > 512 * 1024 ? 413 : 415, 'INVALID_AVATAR', error, { avatar: error })
  const bytes = new Uint8Array(await file.arrayBuffer())
  const signature = file.type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) : file.type === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (!signature) throw new CommerceFailure(415, 'INVALID_AVATAR', 'O conteúdo não corresponde ao formato da imagem.', { avatar: 'Imagem inválida.' })
  try { const bitmap = await createImageBitmap(file); const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width <= 4096 && bitmap.height <= 4096; bitmap.close(); if (!valid) throw new Error() }
  catch { throw new CommerceFailure(400, 'INVALID_AVATAR', 'Imagem inválida ou maior que 4096 × 4096 px.', { avatar: 'Use uma imagem válida de até 4096 × 4096 px.' }) }
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  const profile = db.users.find(user => user.profile.id === session.user.id)!.profile
  profile.avatarUrl = `data:${file.type};base64,${btoa(binary)}`
  return { profile }
 })),
 http.delete(`${base}/account/avatar`, ({ request }) => handle(request, (db, session) => { const profile = db.users.find(user => user.profile.id === session.user.id)!.profile; profile.avatarUrl = null; return { profile } })),
 http.get(`${base}/account/wallets`, ({ request }) => handle(request, (db, session) => view(db, session.user.id))),
 http.patch(`${base}/account/wallet-preferences`, ({ request }) => handle(request, async (db, session) => {
  const body = await json(request)
  if (typeof body.secondaryUsesPrimary !== 'boolean') throw new CommerceFailure(400, 'INVALID_PREFERENCE', 'Informe uma preferência válida.')
  account(db).secondaryUsesPrimary[session.user.id] = body.secondaryUsesPrimary
  return view(db, session.user.id)
 })),
 http.post(`${base}/account/wallets`, ({ request }) => handle(request, async (db, session) => { saveWallet(db, session.user.id, walletInput(await json(request))); invalidateConnections(db, session.user.id); return view(db, session.user.id) }, 201)),
 http.patch(`${base}/account/wallets/:id`, ({ request, params }) => handle(request, async (db, session) => {
  const body = await json(request)
  if (Object.keys(body).length === 1 && body.role === 'primary') promoteWallet(db, session.user.id, String(params.id))
  else saveWallet(db, session.user.id, walletInput(body), String(params.id))
  invalidateConnections(db, session.user.id)
  return view(db, session.user.id)
 })),
]
