import { Link } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
import { useCart } from './use-commerce'
export function CartLink({ mobile = false }: { mobile?: boolean }) {
 const cart = useCart()
 const count = cart.data?.items.reduce((sum, item) => sum + BigInt(item.quantity), 0n) ?? 0n
 return <Link to="/carrinho" aria-label="Carrinho" className={mobile ? 'mobile-cart-link' : 'icon-link'} activeProps={mobile ? { className: 'active mobile-cart-link' } : {}}><ShoppingCart aria-hidden="true"/>{mobile && <span className="sr-only">Carrinho</span>}{count > 0n && <span className="cart-badge" aria-label={`${count} NFTs no carrinho`}>{count.toString()}</span>}</Link>
}
