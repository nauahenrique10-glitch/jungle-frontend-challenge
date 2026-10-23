import type { CatalogNft } from '@/types/catalog'

// Apenas a camada MSW importa estas fixtures. Não há estoque, datas ou classificação inferida.
export const catalogFixtures: readonly CatalogNft[] = [
 { version: 1, id: 'emerald-ape-042', name: 'Emerald Ape #042', priceEth: '1.19', artwork: 'emerald', category: null, network: 'ethereum' },
 { version: 1, id: 'sage-nomad-009', name: 'Sage Nomad #009', priceEth: '1.69', artwork: 'sage', category: null, network: null },
 { version: 1, id: 'neon-vessel-552', name: 'Neon Vessel #552', priceEth: '1.99', previousPriceEth: '2.29', artwork: 'ivory', category: null, network: null },
 { version: 1, id: 'cosmic-bloom-118', name: 'Cosmic Bloom #118', priceEth: '1.29', artwork: 'sage', category: null, network: null },
 { version: 1, id: 'violet-nomad-314', name: 'Violet Nomad #314', priceEth: '1.39', artwork: 'sage', category: null, network: null },
 { version: 1, id: 'ivory-baron-088', name: 'Ivory Baron #088', priceEth: '1.79', artwork: 'ivory', category: null, network: null },
 { version: 1, id: 'golden-beat-207', name: 'Golden Beat #207', priceEth: '0.99', artwork: 'golden', category: null, network: null },
 { version: 1, id: 'golden-frequency-071', name: 'Golden Frequency #071', priceEth: '0.59', artwork: 'golden', category: null, network: null },
 { version: 1, id: 'golden-signal-160', name: 'Golden Signal #160', priceEth: '0.39', artwork: 'golden', category: null, network: null },
]

