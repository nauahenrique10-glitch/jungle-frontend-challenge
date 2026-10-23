import { useEffect, useRef, type ReactNode } from 'react'
import { EyeOff } from 'lucide-react'

export function AccountField({ name, label, value, onChange, error, type = 'text', required = false, placeholder = '', children, disabled = false, autoComplete }: {
 name: string; label: string; value: string; onChange: (value: string) => void; error?: string; type?: string; required?: boolean; placeholder?: string; children?: ReactNode; disabled?: boolean; autoComplete?: string;
}) {
 const shared = { name, id: `account-${name}`, value, disabled, 'aria-label': label, 'aria-required': required, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `account-error-${name}` : undefined, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(event.target.value) }
 return <label className="preview-field" htmlFor={shared.id}><span>{label}{required && <b aria-hidden="true">*</b>}</span><span className="preview-input-wrap">{children ? <select {...shared}>{children}</select> : <input {...shared} type={type} placeholder={placeholder} autoComplete={autoComplete} maxLength={type === 'password' ? 128 : 255}/>} {type === 'password' && <EyeOff aria-hidden="true"/>}</span>{error && <small id={`account-error-${name}`} className="auth-field-error">{error}</small>}</label>
}
const emptyErrors: Record<string, string> = {}
export function AccountFeedback({ error, message, fields = emptyErrors }: { error?: string; message?: string; fields?: Record<string, string> }) {
 const feedback = useRef<HTMLParagraphElement>(null)
 useEffect(() => {
  if (!error) return
  const first = Object.keys(fields)[0]
  const input = first ? document.getElementById(`account-${first}`) : null
  if (input && input instanceof HTMLElement && input.getAttribute('type') !== 'file') input.focus()
  else feedback.current?.focus()
 }, [error, fields])
 return <>{error && <p ref={feedback} role="alert" tabIndex={-1} className="account-feedback account-error">{error}</p>}{message && <p role="status" className="account-feedback">{message}</p>}</>
}
