import { Heart } from 'lucide-react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { commerceError, useFavorites } from './use-commerce'

export function FavoriteButton({ nftId, name, className = '', text = false, preview = false, subtle = false }: { nftId: string; name: string; className?: string; text?: boolean; preview?: boolean; subtle?: boolean }) {
 const favorites = useFavorites(!preview)
 const navigate = useNavigate()
 const location = useRouterState({ select: state => state.location.href })
 const authenticated = favorites.context?.kind === 'user'
 const saved = authenticated && !!favorites.data?.nftIds.includes(nftId)
 const failed = authenticated && favorites.isError
 const busy = favorites.authBusy || favorites.session.isPending || authenticated && favorites.isPending || favorites.pending
 return <span className={`favorite-control ${text ? 'favorite-with-text' : ''} ${className} ${subtle && !saved && !favorites.pending ? 'favorite-subtle' : ''}`}>
  <button type="button" disabled={preview || busy || favorites.session.isError} aria-label={failed ? `Recarregar favoritos de ${name}` : `${saved ? 'Remover dos favoritos' : 'Favoritar'} ${name}`} aria-pressed={saved} title={failed ? 'Não foi possível carregar favoritos. Clique para tentar novamente.' : undefined} onClick={() => {
   if (!authenticated) { void navigate({ to: '/login', search: { redirect: location } }); return }
   if (failed) { void favorites.refetch(); return }
   favorites.toggle(nftId)
  }}><Heart aria-hidden="true" fill={saved ? 'currentColor' : 'none'}/>{text && (saved ? 'Favoritado' : 'Favoritar')}</button>
  {favorites.mutationError && <span className="commerce-operation-error" role="alert">{commerceError(favorites.mutationError)}</span>}
 </span>
}
