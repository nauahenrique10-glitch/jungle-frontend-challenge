import { ImageOff } from 'lucide-react'
export function ArtworkPlaceholder({ label, hero = false }: { label: string; hero?: boolean }) {
  return <div className={`artwork-placeholder ${hero ? 'hero-art' : ''}`} role="img" aria-label={`${label}: arte original indisponível`}><ImageOff aria-hidden="true"/><span>{label}</span><small>Asset original pendente</small></div>
}
