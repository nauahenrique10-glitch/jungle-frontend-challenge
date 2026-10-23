export const guestCartKey = 'kurio:guest-cart-id'
export function getGuestCartId(): string {
 const saved = localStorage.getItem(guestCartKey)
 if (saved && /^[a-f0-9-]{36}$/i.test(saved)) return saved
 return rotateGuestCartId()
}
export function rotateGuestCartId(): string {
 const id = crypto.randomUUID()
 localStorage.setItem(guestCartKey, id)
 return id
}
