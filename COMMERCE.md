# Favoritos e carrinho

Implementação REST simulada: componentes → TanStack Query → Axios → MSW. Não há backend real, pedido ou pagamento. README e referências preservados.

## Contratos

- `GET /api/favorites`: IDs, itens confirmados, userId e versão.
- `POST /api/favorites/:nftId`, `DELETE /api/favorites/:nftId`: inclusão/remoção autenticadas e idempotentes.
- `GET /api/cart`: itens e cotação do proprietário atual.
- `POST /api/cart/items`: `{ nftId, edition: string | null, quantity: number }`.
- `PATCH /api/cart/items/:itemId`: `{ quantity }`.
- `DELETE /api/cart/items/:itemId`.
- `POST /api/cart/coupon`: `{ code }`; `DELETE /api/cart/coupon`.

Mutations aceitam `Idempotency-Key`: repetir a chave com o mesmo corpo não repete a alteração; reutilizar a chave para outro corpo retorna 409. As últimas 200 operações ficam registradas por proprietário. A UI bloqueia submits concorrentes da mesma categoria de recurso; não faz retry automático de mutations.

## Precisão

Preços e todos os valores ETH da API são strings decimais. `services/eth.ts` converte até 18 casas para inteiros BigInt de wei. Multiplicação por quantidade, soma e desconto acontecem apenas no mock, sem ponto flutuante. Descontos usam basis points e arredondamento para baixo no wei. BigInt não cruza JSON: o retorno usa strings. Quantidades são inteiros seguros entre 1 e Number.MAX_SAFE_INTEGER, com teto menor somente quando a disponibilidade tiver sido confirmada.

`networkFeeEth` e `totalEth` são null, com `quoteStatus: checkout-required`; a API fornece `totalBeforeNetworkFeeEth`. A UI exibe A cotar e mantém finalizar desabilitado. O valor de taxa de uma captura de exemplo não é uma cotação para os itens atuais.

## Dados e edições

Nomes, preços e artes vêm das fixtures já confirmadas. A captura Mobile/Carrinho de NFTs confirma Violet Nomad 1/1, Ivory Baron 1/10 e Golden Beat 1/50; essas opções complementam as edições de Emerald já transcritas. Não se deriva estoque do denominador da edição. Os demais itens têm edição null e a UI informa ausência dessa informação. `available: false`, quantidade confirmada zero ou quantidade superior ao limite conhecido são recusados; atualmente não há estoque confirmado para simular esgotamento real.

Cupons exclusivamente demonstrativos, não transcritos do Figma:

- `TESTE10`: desconto de 10%, fixture de teste; após aplicação a UI identifica demonstração.
- `TESTEEXPIRADO`: sempre retorna 410.
- Outros códigos: 422. Erros não removem cupom anterior ou itens.

## Persistência e mesclagem

O banco mock existente (`kurio:mock-auth-db:v1`) recebe lazy migration com `commerce.favorites[userId]` e `commerce.carts[ownerId]`. Proprietários são `guest:UUID` ou `user:userId`; cada linha tem ID técnico, nftId, edition e quantity. O UUID visitante fica em `kurio:guest-cart-id`. Credenciais continuam seguindo AUTH.md, sem senha em texto puro persistida.

Login e cadastro enviam o UUID visitante. Dentro da mesma transação/lock que cria a sessão, o mock:

1. Copia o carrinho autenticado e agrupa por nftId + edition, somando quantidades.
2. Valida toda a mesclagem antes de persistir. Se ultrapassar disponibilidade conhecida ou inteiro seguro, retorna erro sem consumo ou alteração parcial; o visitante pode ajustar o carrinho e tentar novamente. Não há truncamento silencioso.
3. Preserva o cupom autenticado; só herda o cupom visitante quando não existir outro.
4. Persiste o resultado, esvazia e sela o carrinho visitante. O mesmo visitante não pode reaplicar a mesclagem nem aceitar writes tardios.
5. Após resposta de login válida, a aplicação troca o UUID visitante. Logout abre esse visitante novo, separado do carrinho autenticado.

Cadastro/login inválido não consome o visitante. Login repetido não duplica itens. Um write visitante já confirmado antes da transação entra na mesclagem; um write tardio após selagem é recusado. Falha de transporte depois de commit pode deixar resultado incerto: a UI não inventa sucesso; consultar/recarregar recupera estado autoritativo. Como todo MSW local, localStorage é inspecionável pelo usuário e não oferece segurança de produção.

## Isolamento e concorrência

Query keys privadas incluem userId, sessionId, geração de sessão e recurso; visitantes usam UUID e geração. Login, logout, expiração e sincronização externa abortam requisições e cancelam/removem cache anterior. Toda resposta/mutation revalida a identidade capturada antes de atualizar cache. O transporte também confere ownerId/userId retornados. Não há fallback de token inválido para visitante. Favoritos atualizam otimisticamente os IDs e restauram snapshot em falha; a lista confirmada só muda após ACK. Queries canceladas não ressuscitam snapshots de sessão antiga. Leituras do carrinho verificam versão para não substituir cotação mais recente.

Transações mock usam o lock já existente do banco de autenticação (Web Locks, fallback fila em contexto único). A persistência entre abas é serializada com Web Locks; sincronização visual de carrinho/favoritos entre abas não é realtime e ocorre em nova consulta/reload.

## Cenários

`kurio:commerce-scenario` no localStorage (ou VITE_COMMERCE_SCENARIO):

- `success`: 100 ms;
- `latency`: 1200 ms;
- `error500`: leitura e escrita falham;
- `mutation-error`: somente escrita falha;
- `offline`: erro de transporte;
- `coupon-invalid`, `coupon-expired`: falhas determinísticas de cupom.

Os testes usam também uma barreira MSW exclusivamente em tests/e2e/msw-commerce-barrier.ts para segurar respostas já processadas até a troca de sessão, sem sleeps arbitrários. Cada teste mantém seu navegador, worker, storage e banco próprios, conforme AUTH-STABILITY.md. Para reset manual de demonstração, remover o banco, token e UUID visitante com aplicação fechada e recarregar; não há endpoint público de reset.

## Escopo

Favoritos são acessíveis em /favoritos (rota protegida), no coração mobile e na lista de interesse do perfil. Comprar no detalhe apenas adiciona ao carrinho e informa isso explicitamente. Checkout, pagamento, pedidos, Socket.IO e edição de perfil/carteiras continuam indisponíveis. Não foram inventadas categorias, redes, estoque, metadados ou artes.

## Execução e diagnóstico dos testes

A execução com 2 workers completou 238/240 casos. Dois cenários desktop sofreram bloqueios simultâneos: os traces registraram cliques de cerca de 30 s e um fechamento de navegador superior a 60 s. Os POSTs MSW envolvidos responderam 200 (aproximadamente 185–188 ms); o diagnóstico não registrou erro de handler/worker nem ERR_FAILED nessas operações. A máquina tem 4 GB de RAM e havia aproximadamente 220 MB livres durante a ocorrência. Essa é evidência de pressão de recursos e atraso no navegador, sem confirmação definitiva da causa no sistema operacional.

O padrão agora é 1 worker, mantendo um processo Chromium exclusivo por teste. Não foram aumentados timeouts nem inseridos sleeps nos testes. As confirmações de inclusão e favorito aguardam também o ACK HTTP real; a verificação do estado otimista usa uma barreira MSW determinística. Os dois cenários afetados e o cenário otimista passaram em três repetições seriais cada (9/9). A fixture de diagnóstico passa a anexar memória livre, conectividade e status de queries/mutations (sem variáveis, credenciais ou dados privados) quando houver falha. Paralelismo pode ser solicitado com --workers=N, mas deve ser revalidado em máquina com memória suficiente; os travamentos paralelos observados não são declarados definitivamente explicados ou eliminados.

## Arquivos desta etapa

- Tipos: `src/types/commerce.ts`, `src/types/nft-detail.ts`.
- Transporte/domínio: `src/services/commerce.ts`, `eth.ts`, `guest-cart.ts`, `nft-availability.ts`, `auth.ts`.
- Mocks (em `src/services/mocks/`): `commerce-store.ts`, `commerce-handlers.ts`, `auth-store.ts`, `auth-handlers.ts`, `handlers.ts`, `nft-detail-fixtures.ts`.
- Componentes: `src/components/quantity-control.tsx`, `layout.tsx`.
- Carrinho/favoritos (em `src/features/cart/`): `cart-preview.tsx`, `cart-link.tsx`, `favorite-button.tsx`, `favorites-page.tsx`, `use-commerce.ts`.
- Integrações de telas: `src/features/catalog/catalog.tsx`, `src/features/nft/detail-preview.tsx`, `src/features/account/account-preview.tsx`, `session.tsx`, `auth-validation.ts`, `src/app/router.tsx`.
- Estilos: `src/styles/commerce.css`, `globals.css`.
- Testes (em `tests/e2e/`): `commerce.spec.ts`, `catalog-commerce.spec.ts`, `commerce-helpers.ts`, `msw-commerce-barrier.ts`, `test-fixture.ts`, `foundation.spec.ts`, `nft-detail.spec.ts`, `visual-pages.spec.ts`.
- Configuração/documentação: `playwright.config.ts`, `.env.example`, `ARCHITECTURE.md`, `COMMERCE.md`.

As alterações dos testes antigos atualizam somente as expectativas de controles que se tornaram funcionais; os 180 casos anteriores foram mantidos. Os 16 novos cenários são executados nas quatro larguras, somando 64 casos adicionais (244 casos na suíte).

A instrumentação encontrou também uma precondição incorreta no teste de favoritos após navegação/refresh: a asserção de 5 s era iniciada enquanto catálogo e favoritos ainda estavam carregando. O snapshot de falha mostrava skeleton de catálogo e queries privadas pending/fetching, sessão válida e nenhuma mutation em andamento; não houve perda de favorito confirmada. Os helpers agora aguardam o término real das queries TanStack antes de verificar seus resultados, sem sleep ou alteração de timeout. O cenário corrigido e o teste de rollback/mensagem do catálogo passaram nas quatro larguras (8/8). O popup de erro foi limitado à largura útil do card no mobile.


Na execução integral seguinte, 243/244 casos passaram; a única falha foi a preparação visual do carrinho desktop. O diagnóstico mostrava sessão, NFT e carrinho success/idle, mas a asserção começou antes de o CTA estar visível no DOM. O helper agora aguarda o botão visível, além do ciclo de query e do ACK da inclusão. Não houve alteração de timeout configurado. A preparação continua usando o fluxo real de detalhes; passou em 12/12 repetições (três em cada largura) com essa espera por condição real.

## Validação final

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- `npm run test:e2e`: **244/244 aprovados**, 1 worker, retries 0, em 25,3 min, nas larguras 390, 414, 768 e 1440 px.
- Repetições direcionadas: 9/9 dos três cenários de concorrência/mesclagem; 8/8 de persistência/erro de favorito; 12/12 da captura do carrinho (três por largura).
- Inspeção visual final de Home, detalhe e carrinho desktop/mobile e do rodapé mobile; verificações de overflow e espaço da bottom navigation aprovadas.
- README original preservado, SHA-256 `208FF2613E6E3AC4330A40CEFC8610DFC469866167842C480BCB9B6FC5E08B8A`.

Relatório da suíte: `playwright-report/index.html`. Log integral: `.artifacts/commerce-final-suite.log`. Traces das ocorrências anteriores ficam em `.artifacts/commerce-parallel-diagnostics/`. O resultado final serial é verde; o bloqueio observado sob paralelismo continua documentado como risco de ambiente sem causa de sistema operacional definitivamente confirmada.
