import type { AuthDatabase } from './auth-store'
import { marketNft } from './market-store'
import { catalogFixtures } from './catalog-fixtures'
import type { NftDetail } from '@/types/nft-detail'

// Informações adicionais confirmadas exclusivamente no frame de Emerald Ape.
export function findNftDetail(id: string, db?: AuthDatabase): NftDetail | undefined {
 const seed = catalogFixtures.find(item => item.id === id)
 const nft = seed && db ? marketNft(db, seed) : seed
 if (!nft) return undefined
 const detail: NftDetail = {
  ...nft, tokenId: null, collection: null, attributes: [], summary: null, mobileSummary: null,
  description: [], networkDescription: null, editions: [], defaultEditionId: null, availableQuantity: null,
  gallery: [nft.artwork], related: [], rating: null,
 }
 // Edições legíveis no frame Mobile/Carrinho de NFTs, sem inferir disponibilidade.
 const cartEditions: Record<string, { id: string; label: string }> = {
  'violet-nomad-314': { id: '1-1', label: '1/1' },
  'ivory-baron-088': { id: '1-10', label: '1/10' },
  'golden-beat-207': { id: '1-50', label: '1/50' },
 }
 if (id !== 'emerald-ape-042') return cartEditions[id] ? { ...detail, editions: [cartEditions[id]], defaultEditionId: cartEditions[id].id } : detail
 return {
  ...detail,
  tokenId: '#0042', collection: 'Kurio Apes', attributes: ['Óculos', 'Esmeralda', 'Raro'],
  summary: 'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.',
  mobileSummary: 'Um colecionável digital 1/50 finalizado à mão da coleção Kurio Editions, verificado na Ethereum.',
  description: [
   'Emerald Ape #042 é uma obra digital 1/50 finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e verificado na Ethereum. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.',
   'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. Nova Sato recebe 5% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.',
  ],
  editions: [{ id: '1-1', label: '1/1' }, { id: '1-10', label: '1/10' }, { id: '1-50', label: '1/50' }, { id: 'open', label: 'ABERTA' }],
  defaultEditionId: '1-50', rating: { score: '4.8', count: 19 },
  networkDescription: 'Cunhado na Ethereum com procedência imutável e metadados armazenados no IPFS.',
  // Relacionados exibidos pelo frame, sem inferir a coleção dos demais NFTs.
  related: ['cosmic-bloom-118', 'violet-nomad-314', 'ivory-baron-088', 'golden-beat-207', 'golden-signal-160'].flatMap(relatedId => catalogFixtures.filter(item => item.id === relatedId).map(item => db ? marketNft(db, item) : item)),
 }
}

