# Catálogo REST simulado do Kurio

Atualização da etapa de detalhe: os cards agora abrem `/nfts/$nftId` com contexto de catálogo preservado. O frame de detalhe confirma Ethereum para Emerald Ape; somente esse registro deixou de ter network null, e a contagem Ethereum passou a 1. As observações históricas abaixo de todas as redes null/zero estão superadas para esse registro. Todas as categorias e as redes dos outros oito itens continuam não confirmadas. Contrato e evidência: [NFT_DETAIL.md](NFT_DETAIL.md).

## Execução e ativação

`npm ci` e `npm run dev`. O MSW inicia antes da montagem do React, inclusive no build de demonstração. `VITE_ENABLE_MSW=false` desativa a interceptação; nesse caso é necessário fornecer uma API compatível em `VITE_API_URL`. Não existe fallback para fixtures no cliente HTTP ou nos componentes. O service worker versionado em `public/mockServiceWorker.js` foi gerado por `npx msw init public --save`. Service workers exigem localhost ou HTTPS.

`npm run typecheck`, `npm run build`, `npm run preview` e `npm run test:e2e -- --workers=1 --timeout=90000` executam as verificações. README original e PNGs do Figma permanecem intactos.

## Contrato

Endpoint único: `GET /api/nfts` (prefixo configurável por `VITE_API_URL`).

| Parâmetro | Semântica |
| --- | --- |
| `search` | Busca no nome, sem diferenciar caixa ou acentuação; até 120 caracteres. |
| `category` | `arte-digital`, `fotografia`, `musica`, `arte-3d`, `colecionaveis`, `generativa`, `jogos`, `assinaturas`, `utilidade`; vazio não filtra. |
| `network` | `ethereum`, `polygon`, `solana`; vazio não filtra. |
| `minPrice`, `maxPrice` | Strings decimais ETH, limites inclusivos, até 18 casas e 6 dígitos inteiros. Vazios não filtram. |
| `sort` | `reference` (ordem do Figma, não data fictícia), `price-asc`, `price-desc`, `name-asc`. |
| `page` | Inteiro positivo; entrada limitada a 10000, resposta ajustada ao número real de páginas. |
| `pageSize` | 3, 6 ou 9. Padrão 9 para preservar a grade inicial aprovada. Permite paginação real sem duplicar os nove NFTs. |

Exemplo: `/api/nfts?search=Golden%20Signal&category=&network=&minPrice=0.39&maxPrice=0.99&sort=price-asc&page=1&pageSize=3`.

Resposta `200`, tipada em `src/types/catalog.ts`:

```json
{
  "items": [{ "id": "golden-signal-160", "name": "Golden Signal #160", "priceEth": "0.39", "artwork": "golden", "category": null, "network": null }],
  "total": 1,
  "page": 1,
  "pageSize": 3,
  "totalPages": 1,
  "facets": { "categories": [], "networks": [] }
}
```

O exemplo abrevia as facetas; a resposta efetiva inclui todas as opções do Figma e suas contagens reais. `totalPages` é 0 para resultado vazio, `page` permanece 1. Erro `500`: `{ "code": "CATALOG_UNAVAILABLE", "message": "Catálogo temporariamente indisponível." }`.

## Fixtures e limitações confirmadas

`src/services/mocks/catalog-fixtures.ts` contém exatamente os nove NFTs confirmados, com identificador técnico derivado do nome, nome, preço ETH em string, chave de um dos quatro assets e `category`/`network` nulos. Neon Vessel inclui somente o preço anterior legível (2.29 ETH). Não há estoque, token on-chain, datas, criadores, popularidade ou classificação inventada. Somente os handlers MSW importam as fixtures.

Por confirmação explícita do usuário, null não pertence a nenhuma categoria ou rede. Todos os filtros classificados retornam vazio neste conjunto; contagens dessas opções são zero. Os testes comprovam exclusão consistente dos null e combinação dos filtros. Um cenário positivo de categoria/rede dependerá de classificações confirmadas; não foi fabricado para cobrir testes.

A composição mobile inicial move Golden Beat para a quarta posição, preservando o NFT inteiro, inclusive nome/preço/arte. Nas consultas filtradas ou paginadas, a ordem é a retornada pela API. O fundo inert de Login/Cadastro também consulta a API e conserva a distribuição visual de artes do seu frame; não é outro catálogo ou uma fonte de fixtures na UI.

## Estado, cache e concorrência

TanStack Router valida e normaliza todos os parâmetros, remove desconhecidos/repetidos, normaliza decimais, troca limites invertidos e restaura valores seguros para entradas inválidas. Navegações preservam o histórico; refresh e voltar/avançar restauram os controles. Qualquer mudança de busca/filtro/ordenação/tamanho de página reinicia `page=1`. Ajustes de página além do total usam replace. Busca é enviada por Enter ou pelo botão da lupa, sem criar uma entrada de histórico por tecla.

Fluxo exclusivo: componente → `useCatalog` → `getCatalog` → Axios centralizado → HTTP interceptado pelo MSW. Query key `['catalog', 'list', params]`, staleTime de 30 s, coleta após 5 min sem observadores. O `AbortSignal` do Query é repassado ao Axios. Respostas de chaves antigas não substituem a consulta atual. Dados anteriores são mantidos apenas em paginação com os mesmos filtros e pageSize; durante essa transição há aviso e atenuação dos cards. Alterações de filtros não reutilizam cards de filtros anteriores. Retry automático: uma tentativa adicional para falha de rede/5xx após 300 ms; 4xx não são repetidos. O botão de retry consulta novamente via HTTP.

Skeletons usam a geometria dos cards, com shimmer desativado sob movimento reduzido. Há estados de vazio e erro, status aria-live e aria-busy. O filtro mobile usa dialog nativo com foco modal, Escape e retorno de foco. Autenticação, compras, favoritos, checkout, pedidos, otimista e Socket.IO continuam fora desta etapa.

## Cenários determinísticos MSW

Defina `VITE_CATALOG_SCENARIO` antes de iniciar o Vite, ou configure no console do navegador:

```js
localStorage.setItem('kurio:catalog-scenario', 'latency')
location.reload()
```

| Cenário | Comportamento |
| --- | --- |
| `success` | Dados confirmados; latência fixa de 100 ms. |
| `empty` | Lista vazia, sem fabricar NFTs. |
| `latency` | Atraso fixo de 1400 ms para exercitar skeleton/atualização. |
| `error500` | Erro HTTP 500 em todas as tentativas. |
| `out-of-order` | Busca por Emerald leva 1200 ms; outras, 100 ms. Exercita cancelamento e descarte de respostas antigas. |

O cenário é lido exclusivamente na camada MSW por requisição. Voltar a `success` e clicar em Tentar novamente recupera o erro. Ao trocar cenários com dados já em cache, recarregue a página para reiniciar o QueryClient. Reset: `localStorage.removeItem('kurio:catalog-scenario'); location.reload()`. Nenhum endpoint de controle de testes, backend real, evento de socket ou resposta alternativa foi adicionado à UI.

Os testes Playwright usam contextos isolados e requisições realmente interceptadas pelo service worker; não usam page.route para imitar a API. Cobrem loading/dimensões/movimento reduzido, busca, categoria/rede null, preços, sort, páginas, URL inválida, refresh/histórico, vazio, retry limitado e concorrência. As capturas visuais existentes permanecem, atualizadas somente nas expectativas que passaram a representar um catálogo funcional (contagens/paginação reais e carregamento assíncrono).

Referências técnicas: [Search Params do Router](https://tanstack.com/router/latest/docs/guide/search-params), [placeholderData do Query v5](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5), [bootstrap do MSW](https://mswjs.io/api/setup-worker/start).

## Resultado da validação desta etapa

TypeScript e build de produção aprovados. A suíte completa passou: **76 testes**, com 19 por largura (390/414/768/1440), em 5,2 minutos na execução serial. Foram preservados os 36 testes anteriores e adicionadas 40 execuções funcionais. Capturas finais de Home desktop, Login desktop e Home mobile 390/414 foram inspecionadas. Sem overflow horizontal detectado; a reserva da bottom navigation e safe area continua coberta pelos testes. O build contém o worker e o chunk MSW. README original verificado sem alterações.

Arquivos criados/alterados nesta etapa:

- `src/types/catalog.ts`
- `src/features/catalog/home-page.tsx`, `catalog.tsx`, `catalog-params.ts`, `use-catalog.ts`
- `src/services/catalog.ts`
- `src/services/mocks/browser.ts`, `handlers.ts`, `catalog-fixtures.ts`
- `public/mockServiceWorker.js`
- `src/main.tsx`, `src/app/router.tsx`
- `src/styles/globals.css`, `catalog.css`
- `tests/e2e/catalog.spec.ts`, `foundation.spec.ts`, `visual-pages.spec.ts`
- `.env.example`, `package.json`, `ARCHITECTURE.md`, `CATALOG.md`

As abas Novos lançamentos/Em alta continuam desabilitadas por falta de datas/popularidade confirmadas. Outras etapas de negócio e baselines visuais versionadas continuam pendentes; passar nos testes e inspecionar capturas não equivale a concluir o desafio inteiro.
