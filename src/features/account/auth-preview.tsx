import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useIsMutating, useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { EyeOff } from 'lucide-react'
import { HomePage } from '@/features/catalog/home-page'
import { Button } from '@/components/ui/button'
import { authenticate } from '@/services/auth'
import type { AuthApiError, AuthErrors, AuthField, RegisterInput } from '@/types/auth'
import { normalizeAuthSearch, safeAuthDestination, validateAuth } from './auth-validation'
import { useSession } from './session'

export function AuthPreview({ signup = false }: { signup?: boolean }) {
 const search = normalizeAuthSearch(useSearch({ strict: false }))
 const navigate = useNavigate()
 const session = useSession()
 const [values, setValues] = useState<RegisterInput>({ username: '', email: '', password: '', confirmPassword: '' })
 const [errors, setErrors] = useState<AuthErrors>({})
 const [serverError, setServerError] = useState('')
 const [focusRequest, setFocusRequest] = useState(0)
 const inputs = useRef<Partial<Record<AuthField, HTMLInputElement | null>>>({})
 const alert = useRef<HTMLParagraphElement>(null)
 const submitting = useRef(false)
 const activeMutations = useIsMutating({ mutationKey: ['auth'] })
 const mutation = useMutation({
  mutationKey: ['auth', signup ? 'register' : 'login'], retry: false, gcTime: 0, meta: { sensitive: true },
  mutationFn: (input: RegisterInput) => authenticate(signup ? 'register' : 'login', input),
  onSuccess: () => {
   setValues(current => ({ ...current, password: '', confirmPassword: '' }))
   void navigate({ href: safeAuthDestination(search.redirect), replace: true })
  },
  onError: error => {
   const detail = isAxiosError<AuthApiError>(error) ? error.response?.data : undefined
   setErrors(detail?.fields ?? {})
   setServerError(detail?.message || 'Não foi possível concluir. Tente novamente.')
   setFocusRequest(current => current + 1)
  },
  onSettled: () => { submitting.current = false },
 })
 const busy = mutation.isPending || activeMutations > 0
 useEffect(() => { if (mutation.isError || mutation.isSuccess) mutation.reset() }, [mutation.isError, mutation.isSuccess])
 useEffect(() => {
  if (!focusRequest || busy) return
  const first = (['username', 'email', 'password', 'confirmPassword'] as AuthField[]).find(field => errors[field])
  if (first) inputs.current[first]?.focus()
  else if (serverError) alert.current?.focus()
 }, [focusRequest, busy])
 const field = (name: AuthField, label: string, type = 'text') => <label key={name}><span className="sr-only" id={`auth-label-${name}`}>{label}</span><input aria-labelledby={`auth-label-${name}`} ref={element => { inputs.current[name] = element }} name={name} type={type} placeholder={name === 'email' ? 'Digite seu e-mail' : label} value={values[name]} disabled={busy} required aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `auth-error-${name}` : undefined} autoComplete={name === 'email' ? 'email' : name === 'username' ? 'username' : signup ? 'new-password' : 'current-password'} maxLength={name === 'email' ? 254 : name === 'username' ? 24 : 128} onChange={event => { setValues(current => ({ ...current, [name]: event.target.value })); setErrors(current => ({ ...current, [name]: undefined })); setServerError('') }}/>{type === 'password' && <EyeOff aria-hidden="true"/>}{errors[name] && <span className="auth-field-error" id={`auth-error-${name}`}>{errors[name]}</span>}</label>
 return <div className={`preview-page auth-preview ${signup ? 'signup-preview' : ''}`}>
  <div className="auth-background" inert aria-hidden="true"><HomePage authBackdrop/></div>
  <section className="auth-panel" aria-labelledby="auth-title"><Link to="/" className="panel-close" aria-label="Voltar ao início">×</Link><Link to="/" className="auth-brand">KURIO</Link>
   <nav className="auth-tabs" aria-label="Acesso à conta"><Link className={!signup ? 'selected' : ''} to="/login" search={search}>Entrar</Link><span>|</span><Link className={signup ? 'selected' : ''} to="/cadastro" search={search}>Criar conta</Link></nav>
   <h1 id="auth-title">{signup ? 'Criar perfil de colecionador' : 'Entrar'}</h1><p className="auth-intro">{signup ? 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.' : 'Entre para gerenciar sua carteira, coleção e perfil de criador.'}</p>
   {(search.reason === 'expired' || session.data?.reason === 'expired') && <p className="auth-message" role="status">Sua sessão expirou. Entre novamente para continuar.</p>}
   {session.data?.logoutError && <p className="auth-message" role="alert">{session.data.logoutError}</p>}
   <form className="auth-fields" aria-label={signup ? 'Cadastro' : 'Login'} noValidate aria-busy={busy} onSubmit={event => {
    event.preventDefault()
    if (busy || submitting.current) return
    setServerError('')
    const validation = validateAuth(values, signup)
    setErrors(validation)
    if (Object.values(validation).some(Boolean)) { setFocusRequest(current => current + 1); return }
    submitting.current = true
    mutation.mutate({ ...values, username: values.username.trim(), email: values.email.trim() })
   }}>
    {signup && field('username', 'Nome de usuário')}{field('email', 'E-mail', 'email')}{field('password', 'Senha', 'password')}{signup && field('confirmPassword', 'Confirmar senha', 'password')}
    {!signup && <button type="button" className="forgot-password" disabled>Esqueceu a senha?</button>}
    {serverError && <p className="auth-form-error" ref={alert} role="alert" tabIndex={-1}>{serverError}</p>}
    <Button type="submit" disabled={busy} className="auth-submit">{busy ? signup ? 'Criando…' : 'Entrando…' : signup ? <><span className="desktop-copy">Criar conta</span><span className="mobile-copy">Criar perfil</span></> : 'Entrar'}</Button>
   </form>
   <div className="auth-divider">Ou continue com</div><div className="social-auth"><Button disabled variant="outline"><span className="provider-letter google-letter" aria-hidden="true">G</span>Continuar com Google</Button><Button disabled variant="outline"><span className="provider-letter facebook-letter" aria-hidden="true">f</span>Continuar com Facebook</Button></div><p className="auth-switch">{signup ? <>Já tem uma conta? <Link to="/login" search={search}>Entre</Link></> : <>Novo na Kurio? <Link to="/cadastro" search={search}>Crie uma conta</Link></>}</p><p className="preview-notice">Google, Facebook e recuperação de senha indisponíveis nesta etapa.</p>
  </section>
 </div>
}
