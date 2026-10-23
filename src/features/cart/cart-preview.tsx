import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NftArtwork } from '@/components/nft-artwork'
import { PageHeading } from '@/components/visual-preview'
import { QuantityControl } from '@/components/quantity-control'
import { commerceError, useCart, useCartActions } from './use-commerce'

export function CartPreview() {
 const cart = useCart()
 const identity = JSON.stringify(cart.key)
 return <CartContent key={identity}/>
}
function CartContent() {
 const cart = useCart()
 const actions = useCartActions()
 const [coupon, setCoupon] = useState('')
 const data = cart.data
 const identityFailed = cart.session.isError
 const loading = !identityFailed && (cart.isPending || !cart.context)
 return <div className="preview-page cart-preview functional-cart" aria-busy={loading || cart.isFetching || actions.pending}>
  <PageHeading title="Carrinho de NFTs" breadcrumb="Carrinho"/><h1 className="sr-only desktop-copy">Carrinho de NFTs</h1>
  <div className="cart-grid"><section className="cart-items" aria-label="NFTs no carrinho">
   {cart.isError && data && <div className="commerce-error" role="alert">Não foi possível atualizar o carrinho. Os últimos itens confirmados foram preservados. <button type="button" onClick={() => void cart.refetch()}>Tentar novamente</button></div>}<div className="cart-columns"><span>NFTs</span><span>Preço</span><span>Edições</span><span>Total</span></div>
   {loading ? <><p className="sr-only" role="status">Carregando carrinho…</p>{[0, 1, 2].map(index => <div key={index} className="cart-skeleton catalog-shimmer" aria-hidden="true"/>)}</> : identityFailed || cart.isError && !data ? <div className="catalog-feedback" role="alert"><h2>Não foi possível carregar o carrinho</h2><Button onClick={() => void (identityFailed ? cart.session.refetch() : cart.refetch())}>Tentar novamente</Button></div> : !data?.items.length ? <div className="cart-empty"><h2>Seu carrinho está vazio</h2><p>Explore os NFTs e adicione uma obra ao carrinho.</p><Link to="/">Explorar catálogo</Link></div> : data.items.map(item => <div className="cart-item" key={item.id} data-nft-id={item.nftId} data-edition={item.edition ?? ''}>
    <div className="artwork-row"><NftArtwork artwork={item.nft.artwork}/><div className="artwork-row-copy"><Link to="/nfts/$nftId" params={{ nftId: item.nftId }} search={{ edition: item.edition ?? '', quantity: item.quantity }}><strong>{item.nft.name}</strong></Link><small className="cart-token">ID do token: {item.tokenId ?? 'não informado'}</small><small>Edição: {item.editionLabel ?? 'não informada'}</small><small className="cart-inline-unit">{item.unitPriceEth} ETH/un.</small></div>
     <span className="cart-unit-price">{item.unitPriceEth} ETH</span>
     <QuantityControl value={item.quantity} available={item.availableQuantity} disabled={actions.pending} label={`Quantidade de ${item.nft.name} (${item.editionLabel ?? 'não informada'})`} onChange={quantity => actions.execute({ type: 'quantity', itemId: item.id, quantity })}/>
     <span className="cart-item-total" aria-label={`Subtotal de ${item.nft.name}`}>{item.subtotalEth} ETH</span>
     <button type="button" className="cart-remove" disabled={actions.pending} aria-label={`Remover ${item.nft.name} (${item.editionLabel ?? 'não informada'})`} onClick={() => actions.execute({ type: 'remove', itemId: item.id })}><Trash2 aria-hidden="true"/></button>
    </div>
   </div>)}
  </section><aside className="cart-summary"><h2>Resumo da carteira</h2>
   <form noValidate onSubmit={event => { event.preventDefault(); if (coupon.trim()) actions.execute({ type: 'coupon', code: coupon }) }}><label className="coupon-label" htmlFor="cart-coupon">Código promocional<span><input aria-label="Código promocional" id="cart-coupon" disabled={!data || actions.pending} value={coupon} maxLength={32} onChange={event => { setCoupon(event.target.value); actions.reset() }} aria-invalid={!!actions.error} aria-describedby={actions.error ? 'cart-operation-error' : undefined} placeholder="Digite o código promocional..."/><Button type="submit" disabled={!data || actions.pending || !coupon.trim()}>Aplicar</Button></span></label></form>
   {data?.coupon && <div className="applied-coupon"><span>Cupom {data.coupon.code} · demonstração</span><button type="button" disabled={actions.pending} onClick={() => actions.execute({ type: 'remove-coupon' })}>Remover cupom</button></div>}
   {actions.error && <p id="cart-operation-error" className="commerce-error" role="alert">{commerceError(actions.error)}</p>}
   {actions.pending && <p className="commerce-message" role="status">Atualizando carrinho…</p>}
   <dl className={`summary-values ${loading ? 'cart-summary-loading' : ''}`}>
    <div><dt>Subtotal</dt><dd data-testid="cart-subtotal">{data ? `${data.subtotalEth} ETH` : '—'}</dd></div>
    <div><dt>Desconto do lançamento</dt><dd data-testid="cart-discount">{data ? `(-) ${data.discountEth} ETH` : '—'}</dd></div>
    <div><dt>Taxa de rede</dt><dd>{data?.networkFeeEth ? `${data.networkFeeEth} ETH` : 'A cotar'}</dd></div>
    <div><dt>Parcial sem taxa</dt><dd data-testid="cart-partial">{data ? `${data.totalBeforeNetworkFeeEth} ETH` : '—'}</dd></div>
    <div><dt>Total</dt><dd>{data?.totalEth ? `${data.totalEth} ETH` : 'A cotar'}</dd></div>
   </dl>
   <Button asChild disabled={!data?.items.length || actions.pending}>{data?.items.length ? <Link to="/pagamento">Conectar e finalizar</Link> : <span>Conectar e finalizar</span>}</Button><Link to="/">Continuar explorando</Link><p className="commerce-message">Taxa e total final serão apresentados na cotação de checkout. Nenhuma compra foi realizada.</p>
  </aside></div>
  {!!data?.recommendations.length && <section className="related-artworks"><h2>Colecionadores também viram</h2><div>{data.recommendations.map(nft => <article key={nft.id}><Link to="/nfts/$nftId" params={{ nftId: nft.id }}><div><NftArtwork artwork={nft.artwork}/></div><h3>{nft.name}</h3><p>{nft.priceEth} ETH</p></Link></article>)}</div><div className="related-indicators" aria-hidden="true"><i/><i/><i/></div></section>}
 </div>
}



