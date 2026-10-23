import type { CartItem } from './commerce'
import type { AuthUser } from './auth'

/** Reference wallets have null addresses; registered wallets contain user-entered addresses. */
export interface CheckoutWallet { id: string; label: string; displayAddress: string; address: string | null; network: 'Ethereum' | 'Polygon' }
export interface WalletConnection { id: string; userId: string; wallet: CheckoutWallet; provider: string; connected: boolean }
export interface Quote {
 quoteId: string; userId: string; version: number; cartVersion: number; items: CartItem[];
 subtotalEth: string; discountEth: string; networkFeeEth: string; totalEth: string;
 coupon: string | null; currency: 'ETH'; network: string; walletId: string; expiresAt: string;
}
export interface QuoteInput { walletId: string; network: string }
export interface OrderInput { quoteId: string; quoteVersion: number; connectionId: string }
export interface PurchaseAttempt { key: string; input: OrderInput }
export interface Order {
 id: string; userId: string; version: number; status: 'pending' | 'confirmed' | 'refused';
 createdAt: string; resolvedAt: string | null; transactionId: string | null;
 user: Pick<AuthUser, 'id' | 'displayName' | 'username' | 'email'>;
 wallet: CheckoutWallet; provider: string; quote: Quote;
}
export interface CheckoutError { code: string; message: string; quote?: Quote }
