import { useRef, useState, type FormEvent } from 'react'
import { Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AuthSession, AuthUser } from '@/types/auth'
import type { PasswordInput, ProfileInput } from '@/types/account'
import { changeAvatar, changePassword, updateProfile } from '@/services/account'
import { AccountFeedback, AccountField } from './account-fields'
import { acceptProfile, useAccountMutation } from './use-account'
import { validateAvatar, validatePassword, validateProfile } from './account-validation'

const profileValues = (profile: AuthUser): ProfileInput => ({ displayName: profile.displayName, username: profile.username, email: profile.email, ens: profile.ens ?? '', walletNickname: profile.walletNickname ?? '' })
const emptyPassword: PasswordInput = { currentPassword: '', newPassword: '', confirmPassword: '' }
export function ProfileForm({ profile, session }: { profile: AuthUser; session: AuthSession }) {
 const [draft, setDraft] = useState(() => profileValues(profile))
 const [password, setPassword] = useState(emptyPassword)
 const [profileSaved, setProfileSaved] = useState(false)
 const fileInput = useRef<HTMLInputElement>(null)
 const dirty = JSON.stringify(draft) !== JSON.stringify(profileValues(profile))
 const passwordDirty = Object.values(password).some(Boolean)
 const save = useAccountMutation(session, 'profile-password', async (input: { profile: ProfileInput | null; password: PasswordInput | null }) => {
  if (input.profile) {
   const result = await updateProfile(session, input.profile)
   await acceptProfile(session, result)
   setDraft(profileValues(result.profile))
   setProfileSaved(true)
  }
  if (input.password) await changePassword(session, input.password)
 }, () => { setPassword(emptyPassword); setProfileSaved(false) })
 const avatar = useAccountMutation(session, 'avatar', (file: File | null) => changeAvatar(session, file), result => acceptProfile(session, result))
 const busy = save.pending || avatar.pending
 const edit = <K extends keyof ProfileInput>(name: K, value: ProfileInput[K]) => { setDraft(previous => ({ ...previous, [name]: value })); save.clear(); setProfileSaved(false) }
 const submit = (event: FormEvent) => {
  event.preventDefault()
  if (busy) return
  const errors = { ...validateProfile(draft), ...(passwordDirty ? validatePassword(password) : {}) }
  if (Object.keys(errors).length) { save.validation(errors); return }
  if (dirty || passwordDirty) void save.execute({ profile: dirty ? draft : null, password: passwordDirty ? password : null })
 }
 return <><h1>Perfil do colecionador</h1><form onSubmit={submit} noValidate aria-label="Editar perfil" aria-busy={busy} className="account-form">
  <div className="preview-form-grid">
   <AccountField name="displayName" label="Nome de exibição" value={draft.displayName} onChange={value => edit('displayName', value)} error={save.fields.displayName} required disabled={busy} autoComplete="name"/>
   <AccountField name="username" label="Nome de usuário" value={draft.username} onChange={value => edit('username', value)} error={save.fields.username} required disabled={busy} autoComplete="username"/>
   <AccountField name="email" label="E-mail" value={draft.email} onChange={value => edit('email', value)} error={save.fields.email} type="email" required disabled={busy} autoComplete="email"/>
   <AccountField name="ens" label="Nome ENS" value={draft.ens ?? ''} onChange={value => edit('ens', value)} error={save.fields.ens} placeholder=".eth" disabled={busy}/>
   <AccountField name="walletNickname" label="Apelido da carteira" value={draft.walletNickname ?? ''} onChange={value => edit('walletNickname', value)} error={save.fields.walletNickname} disabled={busy}/>
   <div className="avatar-preview"><h2>Avatar</h2><span>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="Avatar do colecionador"/> : <Image aria-hidden="true"/>}</span>
    <input ref={fileInput} id="account-avatar" type="file" name="avatar" aria-label="Selecionar avatar" aria-invalid={avatar.error ? true : undefined} aria-describedby={avatar.error ? 'account-avatar-feedback' : undefined} className="sr-only" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => {
     const file = event.target.files?.[0]; event.target.value = ''
     if (!file) return
     const error = validateAvatar(file)
     if (error) { avatar.validation({ avatar: error }); return }
     void avatar.execute(file)
    }}/>
    <Button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{avatar.pending ? 'Salvando…' : 'Alterar'}</Button><button type="button" disabled={busy || !profile.avatarUrl} onClick={() => void avatar.execute(null)}>Remover</button>
    <div id="account-avatar-feedback" className="avatar-feedback"><AccountFeedback error={avatar.fields.avatar ?? avatar.error} message={avatar.message}/></div>
   </div>
  </div>
  <section className="password-preview"><h2>Alterar senha</h2>{([['currentPassword', 'Senha atual'], ['newPassword', 'Nova senha'], ['confirmPassword', 'Confirmar nova senha']] as const).map(([name, label]) => <AccountField key={name} name={name} label={label} value={password[name]} onChange={value => { setPassword(previous => ({ ...previous, [name]: value })); save.clear() }} error={save.fields[name]} type="password" autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'} disabled={busy}/>)}</section>
  {profileSaved && save.error && <p className="account-feedback" role="status">Dados do perfil salvos. A alteração de senha não foi concluída.</p>}
  <AccountFeedback error={save.error} message={save.message} fields={save.fields}/>
  <Button type="submit" disabled={busy || !dirty && !passwordDirty}>{save.pending ? 'Salvando…' : 'Salvar'}</Button>
 </form></>
}
