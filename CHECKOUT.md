# Checkout, cotação e pagamento simulado

Nenhuma blockchain, extensão de carteira ou transferência real participa deste fluxo. O README original permanece intacto. Socket.IO e eventos não foram implementados nesta etapa.

## Transporte e contratos

Toda operação passa por TanStack Query → Axios centralizado → MSW. As rotas `/pagamento` e `/confirmacao?orderId=<uuid>` exigem sessão, inclusive quando ela expira depois de carregar a página. O login conserva o destino e mescla o carrinho visitante atomicamente, usando o contrato da etapa anterior.

| Endpoint | Resultado |
| --- | --- |
| GET /api/checkout/wallets | Carteiras de demonstração do usuário autenticado |
| POST /api/checkout/connections | `{walletId, provider}` → conexão simulada identificada e vinculada à sessão |
| DELETE /api/checkout/connections/:id | Desconecta a conexão da sessão atual |
| POST /api/checkout/quote | `{walletId, network}` → cotação autoritativa |
| POST /api/orders | `{quoteId, quoteVersion, connectionId}`, cabeçalho `Idempotency-Key` → pedido |
| GET /api/orders/:id | Estado e snapshot do pedido do usuário atual; 404 para outro usuário |
| GET /api/orders | Pedidos exclusivamente do usuário atual, permitindo retomada de pendência |

`Quote` inclui `quoteId`, `userId`, `version` monotônica, `cartVersion`, `items` com identidade de linha, NFT/edição/quantidade e preços unitários/subtotais, `subtotalEth`, `discountEth`, `networkFeeEth`, `totalEth`, `coupon`, `currency`, `network`, `walletId`, `expiresAt`. Dinheiro trafega como string decimal; soma, multiplicação e desconto são calculados em BigInt/wei. Cotação válida por 120 segundos, revalidada também no servidor.

Antes da criação, a API valida novamente cada item, edição, quantidade, disponibilidade conhecida, preços, cupom, taxa, rede e conexão da sessão. Mudança ou expiração retorna 409 `QUOTE_CHANGED` com uma nova cotação. A interface exige novo clique de confirmação; não reenvia automaticamente. Campos de perfil são os dados autenticados, somente leitura. Campos não confirmados do layout ficam indisponíveis, sem validação fictícia ou requisito impossível de preencher.

## Fontes dos dados

Os nove NFTs, edições e imagens são os já existentes. Nenhum estoque foi adicionado. `availableQuantity: null` continua significando disponibilidade desconhecida.

`Mobile/Pagamento.png` confirma Reserva / `nova.kurio.eth` / Polygon e Principal / `0xA91F…E82C` / Ethereum. A simulação fornece essas duas carteiras de exibição a cada conta mock, com IDs técnicos separados por usuário. Isso é uma configuração de demonstração, não uma associação real entre as contas fictícias Alice/Bruno e carteiras reais. `address` é explicitamente `null`: não foi inventado endereço completo. Os provedores WalletConnect, MetaMask e Coinbase Wallet são opções visíveis na referência.

A taxa-base `0.016 ETH` está em Desktop/Pagamento e Confirmação de Pedido. É taxa fixa simulada; inclusive para a carteira Polygon o orçamento é demonstrativo em ETH, sem conversão ou estimativa real de gas. Alterações de `0.01 ETH` por unidade e taxa para `0.018 ETH` são exclusivamente cenários técnicos de teste, não novos preços do catálogo nem dados do Figma. TESTE10 é o cupom de teste documentado em COMMERCE.md.

## Idempotência e falhas de transporte

Antes do primeiro POST, a interface persiste somente `{key, input:{quoteId,quoteVersion,connectionId}}` em `kurio:purchase-attempt:<userId>`. A chave permanece estável depois de timeout, offline, 500 ou refresh. Nenhum dado do recibo, senha ou credencial é copiado para essa chave. Uma tentativa de resultado incerto bloqueia iniciar outra compra e oferece **Recuperar pedido**.

O mock mantém chave, fingerprint canônico dos três campos e pedido na transação persistida do banco de autenticação, protegida pelo mesmo Web Lock do carrinho. Chave igual + conteúdo igual retorna o mesmo pedido antes de revalidar condições atuais; conteúdo diferente retorna 409 `IDEMPOTENCY_CONFLICT`. Chaves pertencem ao usuário. Outro pedido pendente impede uma segunda tentativa concorrente, mesmo usando chave diferente. O ref lock do hook também bloqueia cliques no mesmo tick; mutations não têm retries automáticos.

`commit-timeout` persiste o pedido pendente antes de atrasar a resposta por 16 segundos. O Axios expira em 15 segundos. Somente a primeira criação perde a resposta; reenvio com a chave original recupera o registro, sem duplicação. A lista de pedidos permite recuperar uma pendência mesmo sem metadados locais da tentativa.

## Estados, snapshot e reconciliação

Pedido nasce `pending`, versão 1. GET acompanha o processamento simulado; depois de pelo menos dois segundos pode transicionar para `confirmed` ou `refused`, versão 2. A decisão pertence ao mock. O cenário `pending` suspende a resolução para testes e refresh; mudar para `success` permite concluir. Estados terminais não são reavaliados nem mudam de resultado. Sem consulta, a resolução é preguiçosa e será persistida na próxima leitura, limitação deliberada desta simulação sem backend/Socket.IO.

TanStack Query consulta o pedido a cada 750 ms apenas enquanto pendente e sem erro. Erros interrompem polling até recuperação explícita. Resposta antiga não substitui uma versão mais recente nem um estado terminal. `version` prepara o contrato para futura reconciliação de eventos, sem simular eventos na interface.

O pedido guarda cópia profunda da cotação, usuário, carteira e provedor. A confirmação adiciona data de resolução e `transactionId` com prefixo `simulated:`. O recibo vem desse snapshot; não consulta preços atuais. O link Etherscan está indisponível e identificado como simulado. Pendente e recusado nunca mostram confirmação de sucesso.

Somente na transição confirmada, na mesma transação, o mock subtrai as quantidades compradas das linhas que conservam ID/NFT/edição. Não remove outras linhas. Quantidades acrescidas depois da tentativa permanecem; um contador interno BigInt de unidades removidas por linha impede consumir unidades novas mesmo após reduzir e voltar a aumentar a quantidade. A linha removida e recriada tem outro ID e permanece. Marcador `reconciled` impede repetir efeitos em refresh, polling ou reenvio. Recusa, mudança de cotação e falhas não removem itens. O cupom permanece associado ao carrinho, exceto quando o cenário confirma sua expiração; nesse caso a API o remove e incrementa a versão do carrinho.

## Isolamento e cache

Chaves privadas incluem usuário, sessão e geração de autenticação, além de `wallets`, `quote/quoteId`, `orders` ou `order/orderId`. O cliente captura sessão e credencial e verifica a identidade da resposta. Logout/troca cancela requisições privadas e remove queries/mutations privadas pela infraestrutura existente. Callbacks das mutations também verificam a geração. Estado local é remontado por sessão/geração. Conexões pertencem à sessão; pedidos pertencem ao usuário e podem ser recuperados após novo login do mesmo usuário.

O recibo invalida o carrinho depois da confirmação; não efetua remoção no componente. A lista também atualiza o carrinho ao recuperar pedidos já confirmados. Não há atualização otimista de pagamento.

## Cenários reproduzíveis

No console, `localStorage.setItem('kurio:checkout-scenario', '<cenário>')`. Os handlers consultam a configuração por requisição. Padrão: `success`.

- `success`, `latency` (1200 ms).
- `price-changed`, `fee-changed`, `coupon-expired`: alteração na revalidação e nova confirmação obrigatória. A revisão permanece no banco mock para não oscilar entre confirmações.
- `error500`, `timeout` (antes de processar), `offline`.
- `wallet-refused`, `wallet-error`.
- `payment-refused`, `pending`.
- `commit-timeout`: commit seguido de perda de resposta.

Para reset total, limpar storage do site incluindo `kurio:mock-auth-db:v1`, token, tentativa, cenário e identidade de visitante, e recarregar. Playwright cria navegador/contexto/storage novos por teste, sem dependência da ordem. Não limpar somente o token para simular banco novo.

## Arquivos desta etapa

- `src/types/checkout.ts`.
- `src/services/checkout.ts`, `src/services/auth.ts` (união de recursos privados).
- `src/services/mocks/checkout-store.ts`, `checkout-handlers.ts`, `auth-store.ts`, `handlers.ts`, `commerce-store.ts` e `commerce-handlers.ts` (contador interno de remoções).
- `src/features/checkout/checkout-preview.tsx`, `use-checkout.ts`.
- `src/features/cart/cart-preview.tsx`, `src/features/account/session.tsx`, `src/app/router.tsx`.
- `src/styles/checkout.css`, `globals.css` e `ARCHITECTURE.md`.
- `tests/e2e/checkout.spec.ts`, `checkout-helpers.ts`, `checkout-api.ts`.
- `tests/e2e/visual-pages.spec.ts`, `commerce.spec.ts`, `foundation.spec.ts`: expectativas provisórias substituídas pelos comportamentos agora implementados, sem remover cobertura.
- `vite.config.ts`: diretórios de artefatos, traces e relatório excluídos do monitoramento de fontes.
- `CHECKOUT.md`: contratos, cenários e resultados desta etapa.

## Validação

`npm run typecheck` e `npm run build` passaram. O build avisa sobre o bundle principal acima de 500 kB; otimização final permanece fora desta etapa.

Foram adicionados 19 cenários E2E executados em quatro projetos, elevando a suíte de 244 para **320 testes**. A execução integral concluiu **319 aprovados e 1 falha**, com retries 0. 390, 414 e 1440 tiveram 80/80 aprovados; 768 teve 79/80. O único teste afetado foi `timeout após commit recupera o mesmo pedido com a mesma chave`: a máquina ficou suspensa por aproximadamente 44 minutos durante sua execução, excedendo os limites do teste/encerramento do worker e truncando o trace. O Windows registrou suspensão às 04:40 e retomada às 05:24 (horário local), com origem de ativação “Botão de energia”. Não foi feito aumento de timeout nem retry automático para mascarar esse resultado. O cenário afetado foi então repetido manualmente cinco vezes consecutivas em 768 px: **5/5 aprovados**, em 2,2 minutos, com retries 0. Saída separada em `.artifacts/checkout-timeout-repeats/` e log em `.artifacts/checkout-timeout-repeats.log`, preservando o relatório completo com sua falha original.

O log integral está em `.artifacts/checkout-full-suite-final.log`; relatório HTML em `playwright-report/index.html`; eventos de energia em `.artifacts/checkout-system-power.json`. A execução anterior também foi interrompida por suspensão das 03:36 às 04:09; seu log foi preservado em `.artifacts/checkout-suspended-suite.log`.

Diagnósticos corrigidos durante implementação:

- Uma nova cotação com versão de carrinho maior que o cache local causava alerta transitório incorreto de cotação vencida após expirar o cupom. A comparação agora invalida somente se o carrinho for **mais recente** que a cotação; versões mais antigas aguardando refetch não invalidam condições já revalidadas pela API. O cenário corrigido passou novamente em todas as larguras; a verificação pontual de cupom/latência passou 4/4 em 390 e 414.
- Arquivar um ZIP de trace durante a execução causou `EBUSY` no watcher do Vite no Windows e derrubou aquele servidor. Diretórios gerados agora são ignorados pelo watcher; isso não altera endpoints ou comportamento do produto.

Capturas finais de revisão e recibo foram inspecionadas em desktop/mobile, incluindo 390, 414 e 768. As verificações de overflow e navegação responsiva passaram nas quatro larguras. A navegação inferior permanece oculta nas telas de checkout/recibo conforme a composição existente, sem encobrir conteúdo. O contorno no título do recibo é o estado de foco acessível ao entrar na página.

Não se declara uma execução integral 320/320 sem interrupções: o relatório completo conserva a falha externa. Para obtê-la, é necessário executar `npm run test:e2e` durante um período sem suspensão do computador.

Limitações: fonte e assets existentes preservados; endereço completo e metadados de carteira ausentes não são inventados. Edição de perfil/carteiras, dados de estoque não confirmados, blockchain, Socket.IO, auditoria Lighthouse e deploy continuam fora desta etapa.



