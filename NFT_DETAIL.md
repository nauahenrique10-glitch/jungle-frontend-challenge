# Detalhe funcional do NFT

## Contrato e fluxo

`GET /api/nfts/:id`, via `useNftDetail` → Axios centralizado → MSW. A UI não importa fixtures. A resposta tipada `NftDetail` contém os campos do catálogo e `tokenId`, `collection`, `attributes`, `summary`, `mobileSummary`, `description`, `networkDescription`, `editions`, `defaultEditionId`, `availableQuantity`, `gallery`, `related` e `rating`.

Identificadores aceitos são os nove slugs técnicos do catálogo, por exemplo `/nfts/emerald-ape-042` e `/nfts/sage-nomad-009`. Não são endereços de contrato nem token IDs on-chain. ID desconhecido retorna HTTP 404 com `NFT_NOT_FOUND`; falha simulada retorna HTTP 500 com `NFT_UNAVAILABLE`.

Query key `['nft-detail', nftId]`, staleTime de 30 s e gcTime de 5 min. O AbortSignal é repassado ao Axios; um NFT anterior não é usado como placeholder de outro. Uma tentativa automática adicional para falhas de rede/5xx após 300 ms, nenhuma para 404. O retry manual passa novamente por HTTP. Não há mutações ou respostas alternativas no componente.

## Dados confirmados

Desktop/Detalhes do NFT.png e Mobile/Detalhes do NFT.png foram visualizados integralmente. Os trechos de metadados e descrição desktop também foram inspecionados em recortes na resolução original.

Somente Emerald Ape possui dados adicionais confirmados:

- Nome Emerald Ape #042 e preço 1.19 ETH, compartilhados com o catálogo.
- Token `#0042`, exatamente como no campo da referência, sem derivá-lo do nome `#042`.
- Coleção `Kurio Apes`; atributos `Óculos`, `Esmeralda`, `Raro`.
- Descrições transcritas, incluindo os textos editoriais “Kurio Editions”, “Nova Sato”, 5% e procedência Ethereum/IPFS. O texto editorial cita Kurio Editions, enquanto o campo Coleção informa Kurio Apes; ambos foram preservados como aparecem, sem resolver essa divergência por suposição.
- Edições `1/1`, `1/10`, `1/50`, `ABERTA`; padrão `1/50`. O desktop confirma `1/1`, enquanto o mobile repete `1/10` nas duas primeiras posições: a lista foi baseada no desktop.
- Avaliação visual `4.8` e 19 avaliações, sem funcionalidade de reviews.
- Cinco relacionados que aparecem no frame: Cosmic Bloom, Violet Nomad, Ivory Baron, Golden Beat e Golden Signal. Exibir a seção do frame não atribui artificialmente uma coleção a esses itens.

A rede Ethereum, legível na descrição de Emerald Ape, agora está na fixture compartilhada para manter consistência entre lista/detalhe. Esse filtro encontra somente Emerald Ape e sua contagem é 1. As outras redes e todas as categorias permanecem null; os testes do catálogo foram atualizados para confirmar inclusão do registro conhecido e exclusão dos desconhecidos. Nenhuma classificação foi atribuída aos demais NFTs.

Os outros oito itens retornam nome, preço e arte existentes, com metadados adicionais null/listas vazias. A interface informa ausência de descrição, edição, coleção e token; não extrai token do nome nem inventa estoque, atributos ou textos.

## Edição, quantidade e contexto

Edição e quantidade são estado de URL validado pelo Router (`edition`, `quantity`). Refresh mantém a seleção. Edição não pertencente à resposta é normalizada para a padrão confirmada ou vazio, usando replace. Trocar edição não modifica preços, descrição original ou disponibilidade: não há contratos de preços/estoque por edição confirmados.

Quantidade começa em 1. Os botões, edição numérica e setas do teclado aceitam apenas inteiros positivos seguros. Valores vazios, negativos, fracionários ou maiores que Number.MAX_SAFE_INTEGER são rejeitados/normalizados, sem alterar a quantidade para um valor inválido. O limite superior técnico não representa estoque. `availableQuantity` é null em todas as fixtures; o controlador/normalizador já aceita um limite confirmado futuro. O denominador 50 da edição não vira limite de compra. Os testes usam somente um limite numérico sintético no normalizador puro, sem inserir estoque em API/fixtures/UI.

Cards do catálogo possuem Link real do TanStack Router com os parâmetros atuais (`search`, `category`, `network`, `minPrice`, `maxPrice`, `sort`, `page`, `pageSize`). A rota de detalhe conserva esses parâmetros junto da seleção. Os links Mercado/seta móvel retornam ao catálogo com o mesmo contexto e âncora `catalogo`; o histórico nativo também restaura o estado. Seleções locais usam replace, evitando criar uma entrada de histórico por incremento. Acesso direto usa o contexto padrão seguro.

## Galeria e ações fora do escopo

Há apenas uma imagem confirmada por NFT. `gallery` contém somente essa arte. A galeria admite seleção quando houver mais imagens confirmadas, mas as três posições adicionais do layout atual são repetições decorativas desabilitadas, com nomes/títulos que informam indisponibilidade. Não foram criadas vistas alternativas ou recortes tratados como assets distintos. Imagem principal e composição mobile usam os arquivos existentes.

Compra, carrinho, favoritos, ampliação, compartilhamento e reviews continuam desabilitados, sem feedback de sucesso falso. Não há autenticação, checkout, pedidos, Socket.IO ou backend real.

## Estados e cenários

Skeletons mantêm dimensões da galeria e do painel e respeitam movimento reduzido. Há sucesso, 404 com retorno ao catálogo, 500 com retry e atualização acessível via aria-busy. Mantidas composições desktop/mobile, Roboto Mono e paleta existentes. Os dados maiores podem quebrar linha; não são truncados para esconder informação.

Configure `VITE_DETAIL_SCENARIO` ou o storage lido apenas nos handlers:

```js
localStorage.setItem('kurio:detail-scenario', 'latency')
location.reload()
```

Cenários: `success` (100 ms), `latency` (1400 ms), `not-found` (404), `error500` (500). Para recuperar um erro sem recarregar, troque o storage para `success` e clique em Tentar novamente. Para resetar, remova `kurio:detail-scenario` e recarregue, reiniciando o cache. Os cenários do catálogo têm configuração independente e permanecem disponíveis.

## Verificação e arquivos

`npm run typecheck`, `npm run build`, `npm run test:e2e -- --workers=1 --timeout=90000`.

Arquivos criados/alterados:

- `src/types/nft-detail.ts`
- `src/services/nft-detail.ts`
- `src/services/mocks/nft-detail-fixtures.ts`, `catalog-fixtures.ts`, `handlers.ts`
- `src/features/nft/detail-preview.tsx`, `detail-state.ts`, `use-nft-detail.ts`
- `src/features/catalog/catalog.tsx`
- `src/app/router.tsx`
- `src/styles/nft-detail.css`, `globals.css`
- `tests/e2e/nft-detail.spec.ts`, `catalog.spec.ts`, `foundation.spec.ts`, `visual-pages.spec.ts`
- `.env.example`, `CATALOG.md`, `ARCHITECTURE.md`, `NFT_DETAIL.md`

Limitações: não há estoque confirmado, metadados adicionais dos outros oito NFTs, imagens alternativas, endereço completo de contrato ou preços/disponibilidade por edição. As abas/ações de outras etapas continuam provisórias. README e referências não foram alterados.

Validação concluída: TypeScript e build aprovados; **112 testes Playwright passaram** (28 por largura: 390, 414, 768 e 1440 px), em 8,5 minutos na execução serial. São 76 execuções preservadas/atualizadas da suíte anterior e 36 novas de detalhe. Os testes verificam HTTP/MSW, acesso por card/direto, refresh/histórico/contexto, metadados confirmados/ausentes, seleção, limites de quantidade, 404 sem retry, 500/retry, geometria dos skeletons, movimento reduzido, ações desabilitadas e overflow. As capturas de detalhe 390/414 e desktop 1440 (viewport e página completa), além da Home desktop, foram inspecionadas. Não houve overflow detectado nem regressão funcional do catálogo. A comparação visual continua por inspeção; não há baselines automáticas versionadas. README verificado sem diff.
