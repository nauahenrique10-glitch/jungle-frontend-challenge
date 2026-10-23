import { Link } from '@tanstack/react-router'
import { UserRound, MapPin, ShoppingCart, Heart, ChartNoAxesCombined, Download, TriangleAlert, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

import type { AuthSession, AuthUser } from '@/types/auth'
import { useLogout, usePrivateProfile, useSession } from './session'
import { useIsMutating } from '@tanstack/react-query'
import { ProfileForm } from './profile-form'
import { WalletsForm } from './wallets-form'
import { useAccountWallets } from './use-account'

function AccountNavigation({ wallets }: { wallets: boolean }) {
 const logout = useLogout()
 const busy = useIsMutating({ mutationKey: ['auth'] }) > 0
 return <aside className="account-navigation"><h2>Meu perfil</h2><nav aria-label="Área do colecionador"><Link className={!wallets ? 'selected' : ''} to="/perfil"><UserRound/>Dados do perfil</Link><Link className={wallets ? 'selected' : ''} to="/carteiras"><MapPin/>Carteiras</Link>{[{ Icon: ShoppingCart, label: 'Atividade' }, { Icon: Heart, label: 'Lista de interesse' }, { Icon: ChartNoAxesCombined, label: 'Ofertas' }, { Icon: Download, label: 'Arquivos baixados' }, { Icon: TriangleAlert, label: 'Suporte' }].map(({ Icon, label }) => label === 'Lista de interesse' ? <Link key={label} to="/favoritos"><Icon/>{label}</Link> : <button disabled key={label}><Icon/>{label}</button>)}<button type="button" className="account-logout" disabled={busy} onClick={() => logout.mutate()}><LogOut/>Sair</button></nav></aside>
}
export function AccountPreview({ wallets = false }: { wallets?: boolean }) {
 const session = useSession().data?.session
 return session ? <AccountContent key={session.id} session={session} wallets={wallets}/> : null
}
function AccountContent({ session, wallets }: { session: AuthSession; wallets: boolean }) {
 const query = usePrivateProfile(session)
 return <div className={`preview-page account-preview ${wallets ? 'wallets-preview' : ''}`}><AccountNavigation wallets={wallets}/><section className="account-content" aria-busy={query.isFetching}>{query.isPending ? <AccountLoading wallets={wallets}/> : query.isError ? <div role="alert"><h1>Não foi possível carregar os dados</h1><Button onClick={() => void query.refetch()}>Tentar novamente</Button></div> : wallets ? <WalletContent profile={query.data.profile} session={session}/> : <ProfileForm profile={query.data.profile} session={session}/>}</section></div>
}
function AccountLoading({ wallets }: { wallets: boolean }) {
 return <div role="status" className="account-loading"><h1>{wallets ? 'Carteira principal' : 'Perfil do colecionador'}</h1><div className="preview-form-grid">{Array.from({ length: wallets ? 10 : 6 }, (_, index) => <div key={index} className="account-field-skeleton catalog-shimmer"/>)}</div><p>Carregando dados da sessão…</p></div>
}
function WalletContent({ profile, session }: { profile: AuthUser; session: AuthSession }) {
 const query = useAccountWallets(session)
 if (query.isPending) return <AccountLoading wallets/>
 if (query.isError) return <div role="alert"><h1>Não foi possível carregar as carteiras</h1><Button onClick={() => void query.refetch()}>Tentar novamente</Button></div>
 return <WalletsForm profile={profile} session={session} data={query.data}/>
}


