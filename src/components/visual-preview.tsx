import { Link } from '@tanstack/react-router'
import { ArrowLeft, EyeOff, Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { NftArtwork, type NftArtworkKey } from './nft-artwork'

export function PreviewNotice() {
 return <p className="preview-notice">Prévia visual · Sem operações disponíveis. Dados não carregados.</p>
}
export function PageHeading({ title, breadcrumb, titleInContent = false }: { title: string; breadcrumb?: string; titleInContent?: boolean }) {
 return <><p className="preview-breadcrumb"><Link to="/">Início</Link> / Mercado / {breadcrumb ?? title}</p><div className="preview-mobile-heading"><Link to="/" aria-label="Voltar ao início"><ArrowLeft aria-hidden="true"/></Link>{titleInContent ? <span className="sr-only">{title}</span> : <h1>{title}</h1>}</div></>
}
export function PreviewField({ label, placeholder = '', type = 'text', required = false, select = false, value }: { label: string; placeholder?: string; type?: string; required?: boolean; select?: boolean; value?: string }) {
 return <label className="preview-field"><span>{label}{required && <b aria-hidden="true">*</b>}</span><span className="preview-input-wrap">{select ? <select disabled aria-label={label}><option>{placeholder || 'Selecione uma opção'}</option></select> : <input disabled type={type} value={value} placeholder={placeholder} aria-label={label}/>}{type === 'password' && <EyeOff aria-hidden="true"/>}</span></label>
}
export function QuantityPreview() {
 return <div className="quantity-preview" aria-label="Quantidade indisponível"><button disabled aria-label="Diminuir quantidade"><Minus/></button><span>—</span><button disabled aria-label="Aumentar quantidade"><Plus/></button></div>
}
export function SummaryValues() {
 return <dl className="summary-values">{['Subtotal', 'Desconto do lançamento', 'Taxa de rede', 'Total'].map(label => <div key={label}><dt>{label}</dt><dd>—</dd></div>)}</dl>
}
export function ArtworkRow({ artwork, children }: { artwork: NftArtworkKey; children?: ReactNode }) {
 return <div className="artwork-row"><NftArtwork artwork={artwork}/><div className="artwork-row-copy"><strong>Item a integrar</strong><small>Dados indisponíveis</small></div>{children}</div>
}
export function RelatedArtworks({ title }: { title: string }) {
 const artworks: NftArtworkKey[] = ['sage', 'sage', 'ivory', 'golden', 'golden']
 return <section className="related-artworks"><h2>{title}</h2><div>{artworks.map((artwork, index) => <article key={index}><div><NftArtwork artwork={artwork}/></div><h3>Item a integrar</h3><p>Preço indisponível</p></article>)}</div><div className="related-indicators" aria-hidden="true"><i/><i/><i/></div></section>
}
