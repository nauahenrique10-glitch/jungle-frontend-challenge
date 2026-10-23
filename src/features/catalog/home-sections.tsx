import { ArrowRight } from 'lucide-react'
import { NftArtwork, type NftArtworkKey } from '@/components/nft-artwork'
import { Button } from '@/components/ui/button'
const promotions = [
 { artwork: 'emerald' as const, title: 'Lançamentos gênesis de edição limitada', description: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.' },
 // O final da descrição está encoberto no frame; preservamos somente o trecho legível.
 { artwork: 'ivory' as const, title: 'Arte digital selecionada e muito mais', description: 'Explore novos artistas, coleções verificadas e obras digitais que definem a' },
]
function PromotionCard({ title, description, artwork }: typeof promotions[number]) {
 return <article className="promotion-card"><NftArtwork artwork={artwork}/><div><h2>{title}</h2><p>{description}</p><Button disabled>Explorar <ArrowRight aria-hidden="true"/></Button></div></article>
}
const journalArtworks: NftArtworkKey[] = ['ivory', 'emerald', 'sage', 'golden']
const journalCopy = [
 ['12 de setembro', '6', 'Como funciona a propriedade de NFTs', 'Aprenda a colecionar, negociar e verificar ativos digitais.'],
 ['13 de setembro', '2', '10 artistas digitais para acompanhar', 'Conheça criadores que moldam a cultura digital.'],
 ['15 de setembro', '3', 'Raridade, atributos e procedência', 'Entenda raridade, procedência, direitos autorais e utilidade.'],
 ['15 de setembro', '2', 'Como proteger sua carteira', 'Proteja sua carteira, seus ativos e sua identidade.'],
] as const
function JournalCard({ index }: { index: number }) {
 const [date, minutes, title, description] = journalCopy[index - 1]
 return <article className="journal-card"><NftArtwork artwork={journalArtworks[index - 1]}/><div className="journal-copy"><p className="journal-meta">{date} | Leitura de {minutes} min</p><h3>{title}</h3><p>{description}</p><Button variant="ghost" disabled>Ler mais <ArrowRight aria-hidden="true"/></Button></div></article>
}
export function HomeSections() {
 return <><section className="promotions" aria-label="Destaques promocionais">{promotions.map(promotion => <PromotionCard key={promotion.title} {...promotion}/>)}</section><section className="journal" aria-labelledby="journal-title"><header><h2 id="journal-title">Diário da Cunhagem</h2><p>Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p></header><div className="journal-grid">{[1, 2, 3, 4].map(index => <JournalCard key={index} index={index}/>)}</div></section></>
}

