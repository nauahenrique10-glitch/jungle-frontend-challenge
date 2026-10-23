import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Home, ShoppingCart, UserRound, Heart, ScanLine, LogIn, ShieldCheck, UsersRound, Bell, Search, Instagram, Facebook, Twitter, Linkedin, Youtube } from 'lucide-react'
import { Button } from './ui/button'
import { SessionGate, useSession } from '@/features/account/session'
import { CartLink } from '@/features/cart/cart-link'
import { RealtimeLifecycle } from '@/app/realtime-lifecycle'

export function Layout() {
 const session = useSession()
 const currentLocation = useRouterState({ select: state => state.location })
 const pathname = useRouterState({ select: state => state.location.pathname })
 const isHome = pathname === '/'
 const isMarket = pathname.startsWith('/nfts/') || pathname === '/carrinho' || pathname === '/pagamento'
 const pageKind = pathname === '/login' || pathname === '/cadastro' ? 'auth' : pathname === '/perfil' || pathname === '/carteiras' ? 'account' : pathname === '/confirmacao' ? 'receipt' : isMarket ? 'market' : 'home'
 return <>
  <RealtimeLifecycle/>
  <a className="skip-link" href="#main">Pular para o conteúdo</a>
  <header className={`site-header container ${isHome ? 'home-header' : ''} shell-${pageKind}`}>
   <Link to="/" className="brand" aria-label="Kurio, início">KURIO</Link>
   <nav aria-label="Navegação principal" className="desktop-links"><Link to="/" className={!isMarket ? 'active' : undefined}>Início</Link><a href="/#catalogo" className={isMarket ? 'active' : undefined}>Mercado</a><span title="Fora do escopo desta etapa">Criadores</span><span title="Fora do escopo desta etapa">Aprenda</span></nav>
   <div className="header-actions"><a href="/#catalogo" aria-label="Explorar catálogo" className="icon-link"><Search/></a><CartLink/><Button asChild>{session.data?.session && !session.isError ? <Link to="/perfil" aria-label="Meu perfil"><UserRound/>Perfil</Link> : <Link to="/login" search={{ redirect: currentLocation.pathname === '/login' || currentLocation.pathname === '/cadastro' ? '/perfil' : currentLocation.href }}><LogIn/>Entrar</Link>}</Button></div>
  </header>
  <main id="main" className="container" tabIndex={-1}><SessionGate><Outlet/></SessionGate></main>
  <Footer/>
  <nav className="mobile-nav" aria-label="Navegação mobile">
   <Link to="/" activeProps={{ className: 'active' }}><Home aria-hidden="true"/><span className="sr-only">Início</span></Link>
   <Link to="/favoritos" activeProps={{ className: 'active' }} aria-label="Favoritos"><Heart aria-hidden="true"/></Link>
   <button className="mobile-scan" disabled aria-label="Scanner indisponível"><ScanLine aria-hidden="true"/></button>
   <CartLink mobile/>
   <Link to="/perfil" activeProps={{ className: 'active' }}><UserRound aria-hidden="true"/><span className="sr-only">Perfil</span></Link>
  </nav>
 </>
}

function Footer() {
 const items = [
  { Icon: ShieldCheck, title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { Icon: UsersRound, title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { Icon: Bell, title: 'Alertas de lançamentos', text: 'Calendários de cunhagem e novidades do mercado. Disponível em uma próxima etapa.' },
 ]
 return <footer className="container site-footer">
  <div className="footer-features">{items.map(({ title, text }, index) => <div key={title}><span className="footer-icon" aria-hidden="true">{['W', 'C', 'D'][index]}</span><h3>{title}</h3><p>{text}</p></div>)}<div><h3>Antecipe-se ao próximo lançamento</h3><div className="newsletter-control"><input disabled placeholder="digite seu e-mail..." aria-label="Newsletter indisponível"/><Button disabled>Enviar</Button></div><p>Inscrição na newsletter indisponível nesta etapa.</p></div></div>
  <div className="footer-brand"><strong className="brand">KURIO</strong><p>Feito para colecionadores,<br/>criadores e cultura</p><span>Base em desenvolvimento</span></div>
  <div className="footer-links"><div><h3>Meu perfil</h3><Link to="/perfil">Meu perfil</Link><Link to="/carteiras">Carteiras</Link><Link to="/login">Entrar</Link><Link to="/cadastro">Criar conta</Link></div><div><h3>Central de ajuda</h3>{['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map(label => <button disabled key={label}>{label}</button>)}</div><div><h3>Coleções</h3><p>Arte digital</p><p>Fotografia</p><p>Música</p><p>Arte 3D</p></div><div><h3>Redes sociais</h3><div className="footer-socials">{[{ Icon: Facebook, label: 'Facebook' }, { Icon: Instagram, label: 'Instagram' }, { Icon: Twitter, label: 'Twitter' }, { Icon: Linkedin, label: 'LinkedIn' }, { Icon: Youtube, label: 'YouTube' }].map(({ Icon, label }) => <button key={label} disabled aria-label={`${label} indisponível`}><Icon aria-hidden="true"/></button>)}</div><h3>Carteiras compatíveis</h3><p className="wallet-label">METAMASK · WALLETCONNECT · COINBASE</p><p>Integração simulada prevista para as próximas etapas.</p></div></div>
  <p className="copyright">© 2026 Kurio. Propriedade digital para todos.</p>
 </footer>
}

