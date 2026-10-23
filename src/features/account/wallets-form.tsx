import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import type { AuthSession, AuthUser } from '@/types/auth'
import type { AccountWallet, WalletInput, WalletRole, WalletsResponse } from '@/types/account'
import { promoteAccountWallet, saveAccountWallet, setWalletPreference } from '@/services/account'
import { AccountField, AccountFeedback } from './account-fields'
import { acceptWallets, useAccountMutation } from './use-account'
import { validateWallet } from './account-validation'

const emptyWallet = (profile: AuthUser, role: WalletRole): WalletInput => ({ displayName: profile.displayName, label: '', network: '', username: profile.username, address: '', secondaryAddress: '', provider: '', referralCode: '', email: profile.email, ens: profile.ens ?? '', role })
const values = (wallet: AccountWallet): WalletInput => ({ displayName: wallet.displayName, label: wallet.label, network: wallet.network, username: wallet.username, address: wallet.address ?? '', secondaryAddress: wallet.secondaryAddress, provider: wallet.provider, referralCode: wallet.referralCode, email: wallet.email, ens: wallet.ens, role: wallet.role })
export function WalletsForm({ profile, session, data }: { profile: AuthUser; session: AuthSession; data: WalletsResponse }) {
 const primary = data.wallets.find(wallet => wallet.role === 'primary')
 const [editingId, setEditingId] = useState<string | undefined>(primary?.id)
 const current = data.wallets.find(wallet => wallet.id === editingId)
 const [draft, setDraft] = useState<WalletInput>(() => primary ? values(primary) : emptyWallet(profile, 'primary'))
 const [pendingPreference, setPendingPreference] = useState<boolean | null>(null)
 const dirty = !editingId || JSON.stringify(draft) !== JSON.stringify(current ? values(current) : emptyWallet(profile, 'primary'))
 const save = useAccountMutation(session, 'wallet-save', (input: { draft: WalletInput; id?: string }) => saveAccountWallet(session, input.draft, input.id), async result => {
  await acceptWallets(session, result)
  const wallet = result.wallets.find(item => item.id === editingId) ?? result.wallets.at(-1)!
  setEditingId(wallet.id); setDraft(values(wallet))
 })
 const priority = useAccountMutation(session, 'wallet-priority', (id: string) => promoteAccountWallet(session, id), async result => {
  await acceptWallets(session, result)
  const wallet = result.wallets.find(item => item.role === 'primary')!
  setEditingId(wallet.id); setDraft(values(wallet))
 })
 const preference = useAccountMutation(session, 'wallet-preference', (value: boolean) => setWalletPreference(session, value), result => acceptWallets(session, result))
 const busy = save.pending || priority.pending || preference.pending
 const edit = (wallet: AccountWallet) => { setEditingId(wallet.id); setDraft(values(wallet)); save.clear(); priority.clear(); document.querySelector('.account-title')?.scrollIntoView({ block: 'start' }); document.getElementById('account-displayName')?.focus() }
 const add = (role: WalletRole) => { setEditingId(undefined); setDraft(emptyWallet(profile, role)); save.clear(); priority.clear(); document.getElementById('account-displayName')?.focus() }
 const field = (name: keyof WalletInput, label: string, options: { required?: boolean; placeholder?: string; type?: string; children?: React.ReactNode } = {}) => <AccountField name={name} label={label} value={draft[name]} onChange={value => { setDraft(previous => ({ ...previous, [name]: value })); save.clear() }} error={save.fields[name]} disabled={busy} {...options}/>
 const submit = (event: FormEvent) => { event.preventDefault(); if (busy) return; const errors = validateWallet(draft); if (Object.keys(errors).length) { save.validation(errors); return }; void save.execute({ draft, id: editingId }) }
 return <><div className="account-title" tabIndex={-1}><h1>{!editingId ? 'Adicionar carteira' : current?.role === 'secondary' ? 'Carteira secundária' : 'Carteira principal'}</h1><button type="button" disabled={busy} onClick={() => add('primary')}>Adicionar</button></div><p>Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
  <form noValidate aria-label="Editar carteira" aria-busy={busy} className="account-form" onSubmit={submit}><div className="preview-form-grid">
   {field('displayName', 'Nome de exibição', { required: true })}{field('label', 'Apelido da carteira', { required: true })}
   {field('network', 'Rede', { required: true, children: <><option value="">Selecione uma rede</option><option>Ethereum</option><option>Polygon</option></> })}{field('username', 'Nome do perfil', { required: true })}
   {field('address', 'Endereço da carteira', { required: true, placeholder: 'Endereço 0x da carteira' })}{field('secondaryAddress', 'Carteira secundária', { placeholder: 'ENS ou carteira secundária (opcional)' })}
   {field('provider', 'Tipo de carteira', { required: true, children: <><option value="">Selecione uma carteira</option>{['WalletConnect', 'MetaMask', 'Coinbase Wallet'].map(name => <option key={name}>{name}</option>)}</> })}{field('referralCode', 'Código de indicação')}
   {field('email', 'E-mail', { required: true, type: 'email' })}{field('ens', 'Nome ENS', { placeholder: '.eth' })}
  </div><AccountFeedback error={save.error} message={save.message} fields={save.fields}/><Button type="submit" disabled={busy || !dirty}>{save.pending ? 'Salvando…' : 'Salvar carteira'}</Button>{!editingId && <button className="account-cancel" type="button" disabled={busy} onClick={() => { if (primary) edit(primary) }}>Cancelar</button>}</form>
  <AccountFeedback error={priority.error || preference.error} message={priority.message || preference.message}/>
  <div className="secondary-wallet"><div><h2>Carteira secundária</h2><p>{data.secondaryUsesPrimary ? 'Usando a carteira principal.' : !data.wallets.some(wallet => wallet.role === 'secondary') ? 'Você ainda não adicionou uma carteira secundária.' : 'Carteiras secundárias cadastradas.'}</p></div><label><input type="checkbox" checked={pendingPreference ?? data.secondaryUsesPrimary} disabled={busy} aria-busy={preference.pending} onChange={async event => {
   const checked = event.target.checked
   setPendingPreference(checked)
   try { await preference.execute(checked) } finally { setPendingPreference(null) }
  }}/>Igual à carteira principal</label><button type="button" disabled={busy} onClick={() => add('secondary')}>Adicionar</button></div>
  <div className="account-wallet-list" aria-label="Carteiras cadastradas">{data.wallets.map(wallet => <article className="account-wallet-row" key={wallet.id} data-testid={`wallet-${wallet.id}`}><div><h3>{wallet.label} · {wallet.role === 'primary' ? 'Principal' : 'Secundária'}</h3><p>{wallet.network} · {wallet.displayAddress}</p></div><div><button type="button" disabled={busy} aria-label={`Editar ${wallet.label}`} onClick={() => edit(wallet)}>Editar</button>{wallet.role !== 'primary' && <button type="button" disabled={busy} aria-label={`Definir ${wallet.label} como principal`} onClick={() => void priority.execute(wallet.id)}>Definir como principal</button>}</div></article>)}</div>
 </>
}
