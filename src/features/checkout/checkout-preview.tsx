import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { MailOpen, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NftArtwork } from '@/components/nft-artwork'
import { PageHeading, PreviewField } from '@/components/visual-preview'
import { useSession } from '@/features/account/session'
import { commerceError, useCart } from '@/features/cart/use-commerce'
import { authGeneration } from '@/services/auth'
import { clearAttempt, connectWallet, disconnectWallet, newAttempt, readAttempt, saveAttempt } from '@/services/checkout'
import { queryClient } from '@/app/query-client'
import type { AuthSession } from '@/types/auth'
import type { CheckoutError, PurchaseAttempt, Quote, WalletConnection } from '@/types/checkout'
import { checkoutKey, useCheckoutWallets, useOrder, useOrderMutation, useOrders, usePrivateMutation, useQuoteMutation } from './use-checkout'
import { useRealtime } from '@/app/realtime-lifecycle'
import { nftVersion } from '@/services/realtime'

function checkoutError(error: unknown) { return isAxiosError(error) && error.code === 'ECONNABORTED' ? 'Tempo de resposta excedido. Se houve envio, recupere a mesma tentativa antes de iniciar outra compra.' : commerceError(error) }

function QuoteItems({ quote }: { quote: Quote }) {
 return <>{quote.items.map(item => <div className="artwork-row checkout-item" key={item.id}><NftArtwork artwork={item.nft.artwork}/><div className="artwork-row-copy"><strong>{item.nft.name}</strong><small>{item.tokenId ? `ID do token: ${item.tokenId}` : 'Token não informado'}</small><small>{item.editionLabel ?? 'Edição não informada'} · <span className="checkout-quantity">× {item.quantity}</span></small></div><span>{item.subtotalEth} ETH</span></div>)}</>
}
function QuoteSummary({ quote }: { quote: Quote | null }) {
 return <dl className="summary-values checkout-values">{[['Subtotal', quote?.subtotalEth], ['Desconto do lançamento', quote?.discountEth], ['Taxa de rede', quote?.networkFeeEth], ['Total', quote?.totalEth]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd data-testid={label === 'Total' ? 'quote-total' : undefined}>{value ? `${value} ETH` : 'A cotar'}</dd></div>)}</dl>
}
export function CheckoutPreview() {
 const session = useSession().data?.session
 return session ? <CheckoutContent key={`${session.id}:${authGeneration()}`} session={session}/> : null
}
function CheckoutContent({ session }: { session: AuthSession }) {
 useRealtime()
 const navigate = useNavigate()
 const cart = useCart()
 const wallets = useCheckoutWallets(session)
 const orders = useOrders(session)
 const [walletId, setWalletId] = useState('')
 const selectedId = walletId || wallets.data?.wallets[0]?.id || ''
 const selected = wallets.data?.wallets.find(wallet => wallet.id === selectedId)
 const [provider, setProvider] = useState('Coinbase Wallet')
 const [connection, setConnection] = useState<WalletConnection | null>(null)
 const [quote, setQuote] = useState<Quote | null>(null)
 const [expired, setExpired] = useState(false)
 useEffect(() => {
  setExpired(false)
  if (!quote) return
  const timer = window.setTimeout(() => setExpired(true), Math.max(0, Date.parse(quote.expiresAt) - Date.now()) + 1)
  return () => window.clearTimeout(timer)
 }, [quote?.quoteId])
 const [attempt, setAttempt] = useState<PurchaseAttempt | null>(() => readAttempt(session.user.id))
 const [changed, setChanged] = useState(false)
 const [message, setMessage] = useState('')
 const quoteMutation = useQuoteMutation(session, data => { setQuote(data); setChanged(false); setMessage('Cotação pronta. Revise os valores antes de confirmar.'); clearAttempt(session.user.id); setAttempt(null) })
 const connectionMutation = usePrivateMutation(session, 'connect', () => connectWallet(session, selectedId, provider), data => { setConnection(data); setMessage('Carteira conectada · simulação, sem blockchain real.') })
 const disconnect = usePrivateMutation(session, 'disconnect', () => disconnectWallet(session, connection!.id), () => { setConnection(null); setMessage('Carteira desconectada.') })
 const purchase = useOrderMutation(session, order => {
  clearAttempt(session.user.id); setAttempt(null)
  queryClient.setQueryData(checkoutKey(session, 'order', order.id), order)
  void navigate({ to: '/confirmacao', search: { orderId: order.id } })
 }, error => {
  if (isAxiosError<CheckoutError>(error) && error.response?.data.code === 'QUOTE_CHANGED' && error.response.data.quote) {
   const fresh = error.response.data.quote
   setQuote(fresh); queryClient.setQueryData(checkoutKey(session, 'quote', fresh.quoteId), fresh); setChanged(true)
   clearAttempt(session.user.id); setAttempt(null); setMessage(error.response.data.message)
   void queryClient.invalidateQueries({ queryKey: cart.key, exact: true })
  } else if (isAxiosError<CheckoutError>(error) && error.response && error.response.status < 500) {
   clearAttempt(session.user.id); setAttempt(null)
   if (error.response.data.code === 'WALLET_DISCONNECTED') setConnection(null)
  }
 })
 const pendingOrder = orders.data?.orders.find(order => order.status === 'pending')
 useEffect(() => { if (orders.data?.orders.some(order => order.status === 'confirmed')) void queryClient.invalidateQueries({ queryKey: cart.key, exact: true }) }, [orders.dataUpdatedAt])
 const busy = quoteMutation.isPending || connectionMutation.isPending || disconnect.isPending || purchase.isPending
 const initial = cart.isPending || wallets.isPending || orders.isPending
 const failure = cart.isError || wallets.isError || orders.isError
 // A replacement quote can be newer than the cart cache while its refetch is in flight.
 // Only a NEWER cart invalidates the quote; an older cached response must not mark it stale.
 const quoteStale = !!quote && (expired || quote.items.some(item => nftVersion(item.nftId) > item.nft.version) || quote.cartVersion < (cart.data?.version ?? 0) || quote.walletId !== selectedId || Date.parse(quote.expiresAt) <= Date.now())
 const error = purchase.error || quoteMutation.error || connectionMutation.error || disconnect.error
 const resetSelection = () => { setConnection(null); setQuote(null); setChanged(false); setMessage(''); connectionMutation.reset(); purchase.reset(); quoteMutation.reset() }
 const confirm = () => {
  if (busy || !connection || !quote || quoteStale) return
  const next = attempt ?? newAttempt({ quoteId: quote.quoteId, quoteVersion: quote.version, connectionId: connection.id })
  saveAttempt(session.user.id, next); setAttempt(next); purchase.execute(next)
 }
 return <div className="preview-page checkout-preview functional-checkout" aria-busy={initial || busy}>
  <PageHeading title="Pagamento com carteira" breadcrumb="Pagamento"/>
  {initial ? <div className="checkout-skeleton catalog-shimmer" role="status">Carregando checkout…</div> : failure ? <section className="catalog-feedback" role="alert"><h2>Não foi possível carregar o checkout</h2><Button onClick={() => { void cart.refetch(); void wallets.refetch(); void orders.refetch() }}>Tentar novamente</Button></section> : pendingOrder ? <section className="catalog-feedback"><h2>Pedido pendente</h2><p>Uma compra está aguardando o resultado da simulação.</p><Link to="/confirmacao" search={{ orderId: pendingOrder.id }}>Acompanhar pedido</Link></section> : attempt ? <section className="catalog-feedback"><h2>Recuperar tentativa de compra</h2><p>A resposta anterior não foi confirmada. Reenvie a mesma tentativa para recuperar o pedido sem duplicá-lo.</p><Button disabled={busy} onClick={() => purchase.execute(attempt)}>Recuperar pedido</Button>{purchase.isPending && <p role="status">Recuperando pedido…</p>}{purchase.isError && <p role="alert">{checkoutError(purchase.error)}</p>}</section> : !cart.data?.items.length ? <section className="catalog-feedback"><h2>Seu carrinho está vazio</h2><Link to="/">Explorar catálogo</Link></section> : <div className="checkout-grid">
   <section className="checkout-fields"><h2>Perfil do colecionador</h2><div className="preview-form-grid">
    <PreviewField label="Nome de exibição" value={session.user.displayName}/><PreviewField label="Nome de usuário" value={session.user.username}/>
    <label className="preview-field">Rede<select aria-label="Rede" value={selected?.network ?? ''} disabled={busy} onChange={event => { const wallet = wallets.data?.wallets.find(item => item.network === event.target.value); if (wallet) { setWalletId(wallet.id); resetSelection() } }}>{wallets.data?.wallets.map(wallet => <option key={wallet.id} value={wallet.network}>{wallet.network}</option>)}</select></label>
    <PreviewField label="Nome do perfil" value={session.user.username}/><PreviewField label="Endereço da carteira" value={selected?.displayAddress}/><PreviewField label="Carteira secundária" value={wallets.data?.wallets.find(wallet => wallet.id !== selectedId)?.displayAddress}/>
    <PreviewField label="Tipo de carteira" value={provider}/><PreviewField label="Código de indicação" placeholder="Não informado"/><PreviewField label="E-mail" value={session.user.email}/><PreviewField label="Nome ENS" value={selected?.displayAddress.endsWith('.eth') ? selected.displayAddress : ''}/>
   </div><label className="preview-field checkout-note"><span>Observação do colecionador (opcional)</span><textarea disabled aria-label="Observação do colecionador"/></label><p className="preview-notice">Dados da sessão e carteiras de demonstração. Endereço completo não disponibilizado no Figma.</p></section>
   <aside className="checkout-summary"><section className="checkout-items"><h2>Seus NFTs</h2><div className="receipt-columns"><span>NFTs</span><span>Subtotal</span></div>{quote ? <QuoteItems quote={quote}/> : cart.data.items.map(item => <div className="artwork-row checkout-item" key={item.id}><NftArtwork artwork={item.nft.artwork}/><div className="artwork-row-copy"><strong>{item.nft.name}</strong><small>× {item.quantity} · {item.editionLabel ?? 'Edição não informada'}</small></div><span>{item.subtotalEth} ETH</span></div>)}</section>
    <QuoteSummary quote={quote}/>{cart.data.coupon && <p className="commerce-message">Cupom {cart.data.coupon.code} · {quote?.coupon === null ? 'não aplicado na nova cotação' : 'demonstração'}</p>}
    <fieldset className="checkout-wallets"><legend>Carteira {connection ? 'conectada' : 'cadastrada'}</legend>{wallets.data?.wallets.map(wallet => <label key={wallet.id}><input type="radio" name="checkout-wallet" aria-label={`Carteira ${wallet.label}`} checked={wallet.id === selectedId} disabled={busy} onChange={() => { setWalletId(wallet.id); resetSelection() }}/><span><strong>{wallet.label}</strong><small>{wallet.displayAddress}</small><small>Rede {wallet.network}</small></span></label>)}</fieldset>
    <fieldset className="wallet-choices"><legend>Carteira e rede</legend>{['WalletConnect', 'MetaMask', 'Coinbase Wallet'].map(value => <label key={value}><Wallet aria-hidden="true"/><span>{value}</span><input aria-label={value} type="radio" name="provider" checked={provider === value} disabled={busy} onChange={() => { setProvider(value); setConnection(null); connectionMutation.reset() }}/></label>)}</fieldset>
    <div className="checkout-actions"><Button variant="outline" disabled={busy} onClick={() => connection ? disconnect.execute(undefined) : connectionMutation.execute(undefined)}>{disconnect.isPending ? 'Desconectando…' : connectionMutation.isPending ? 'Conectando carteira…' : connection ? 'Desconectar carteira' : 'Conectar carteira simulada'}</Button><Button variant="outline" disabled={busy || !selected} onClick={() => { purchase.reset(); quoteMutation.execute({ walletId: selectedId, network: selected!.network }) }}>{quoteMutation.isPending ? 'Cotando…' : quote ? 'Atualizar cotação' : 'Cotar compra'}</Button></div>

    {changed && <p className="commerce-error" role="alert">Os valores mudaram. Revise a nova cotação e confirme novamente.</p>}{quoteStale && <p className="commerce-error" role="alert">Cotação expirada ou carrinho alterado. Atualize a cotação.</p>}
    {message && <p className="commerce-message" role="status">{message}</p>}{error && !changed && <p className="commerce-error" role="alert">{checkoutError(error)}</p>}
    <Button className="checkout-submit" disabled={busy || !connection || !quote || quoteStale} onClick={confirm}>{purchase.isPending ? 'Criando pedido…' : changed ? 'Confirmar novos valores' : 'Confirmar compra'}</Button>
    <p className="preview-notice">Pagamento simulado. Nenhuma transferência real será realizada.</p>
   </aside>
  </div>}
 </div>
}
export function ReceiptPreview({ orderId = '' }: { orderId?: string }) {
 const session = useSession().data?.session
 return session ? <OrderContent key={`${session.id}:${authGeneration()}:${orderId}`} session={session} orderId={orderId}/> : null
}
function OrderContent({ session, orderId }: { session: AuthSession; orderId: string }) {
 const heading = useRef<HTMLHeadingElement>(null)
 useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [orderId])
 const query = useOrder(session, orderId)
 const cart = useCart()
 const order = query.data
 useEffect(() => { if (order?.status === 'confirmed') void queryClient.invalidateQueries({ queryKey: cart.key, exact: true }) }, [order?.status, order?.id])
 return <div className="preview-page receipt-preview functional-receipt"><section className="receipt-panel"><Link to="/" className="panel-close" aria-label="Voltar ao início">×</Link>
  <header><MailOpen aria-hidden="true"/><h1 ref={heading} tabIndex={-1}>{order?.status === 'confirmed' ? 'Seus NFTs agora estão na sua carteira' : order?.status === 'pending' ? 'Pagamento pendente' : order?.status === 'refused' ? 'Pagamento recusado' : 'Confirmação de pedido'}</h1><p>{!orderId ? 'Nenhum pedido confirmado.' : query.isPending ? 'Consultando pedido…' : order?.status === 'pending' ? 'Aguardando confirmação da API simulada.' : order?.status === 'refused' ? 'O carrinho foi preservado. Nenhuma compra confirmada.' : order?.status === 'confirmed' ? 'Pedido confirmado pela simulação.' : ''}</p></header>
  {orderId && query.isPending && <div className="checkout-skeleton catalog-shimmer" role="status">Carregando pedido…</div>}
  {query.isError && <div className="checkout-order-error" role="alert"><p>{isAxiosError(query.error) && query.error.response?.status === 404 ? 'Pedido não encontrado para este usuário.' : commerceError(query.error)}</p><Button onClick={() => void query.refetch()}>Recuperar pedido</Button></div>}
  {order && <><dl className="receipt-metadata"><div><dt>ID da transação</dt><dd title={order.transactionId ?? ''}>{order.transactionId ? `sim:${order.id.slice(0, 8)}` : 'Pendente'}</dd></div><div><dt>Data</dt><dd>{new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(order.resolvedAt ?? order.createdAt))}</dd></div><div><dt>Total</dt><dd>{order.quote.totalEth} ETH</dd></div><div><dt>Carteira</dt><dd>{order.provider}</dd></div></dl>
   <div className="receipt-body"><h2>{order.status === 'confirmed' ? 'Detalhes da transação' : 'Revisão do pedido'}</h2><p className="receipt-order-id">Pedido: {order.id}</p><div className="receipt-columns"><span>NFTs</span><span>Edições / Subtotal</span></div><QuoteItems quote={order.quote}/><QuoteSummary quote={order.quote}/>
    <p>{order.user.displayName} · {order.user.email}<br/>{order.wallet.label}: {order.wallet.displayAddress}<br/>Rede {order.quote.network}</p>
    {order.status === 'pending' && <p role="status">Pedido pendente · acompanhando a API. Você pode recarregar esta página.</p>}
    {order.status === 'confirmed' && <p role="status">Pagamento confirmado. Recibo imutável da simulação; nenhum NFT foi transferido em blockchain real.</p>}
    {order.status === 'refused' && <Link to="/pagamento">Voltar ao checkout</Link>}
    <Button disabled title="Transação simulada, sem registro blockchain">Ver no Etherscan · simulado</Button>
   </div></>}
  {!orderId && <div className="receipt-body"><Link to="/pagamento">Ir ao checkout</Link><Button disabled>Ver no Etherscan · simulado</Button></div>}
 </section></div>
}





