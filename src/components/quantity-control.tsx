import { Minus, Plus } from 'lucide-react'
export function QuantityControl({ value, available, onChange, disabled = false, label = 'Quantidade' }: { value: number; available: number | null; onChange: (value: number) => void; disabled?: boolean; label?: string }) {
 const max = available === null ? Number.MAX_SAFE_INTEGER : Math.max(1, available)
 const unavailable = disabled || available === 0
 return <div className="quantity-preview quantity-control" role="group" aria-label={label === 'Quantidade' ? 'Quantidade do NFT' : label}>
  <button type="button" disabled={value <= 1 || unavailable} aria-label="Diminuir quantidade" onClick={() => onChange(value - 1)}><Minus aria-hidden="true"/></button>
  <input aria-label={label} role="spinbutton" inputMode="numeric" pattern="[0-9]+" aria-valuemin={1} aria-valuemax={available ?? undefined} aria-valuenow={value} value={value} disabled={unavailable} maxLength={16} onChange={event => {
   const text = event.target.value
   const next = Number(text)
   if (/^\d+$/.test(text) && Number.isSafeInteger(next) && next >= 1 && next <= max) onChange(next)
  }} onKeyDown={event => {
   if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    onChange(Math.max(1, Math.min(max, value + (event.key === 'ArrowUp' ? 1 : -1))))
   }
  }}/>
  <button type="button" disabled={value >= max || unavailable} aria-label="Aumentar quantidade" onClick={() => onChange(value + 1)}><Plus aria-hidden="true"/></button>
 </div>
}
