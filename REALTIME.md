# Tempo real do Kurio

## Transporte e inicialização

O cliente é `socket.io-client` 4.x, conectado exclusivamente por WebSocket em `/kurio-socket/`, no namespace padrão. MSW intercepta o WebSocket no navegador; `@mswjs/socket.io-binding` 0.2.0 codifica/decodifica os frames Engine.IO/Socket.IO. Não há EventEmitter substituindo o cliente, servidor Node, dependência de infraestrutura privada ou eventos disparados por componentes.

O [binding oficial](https://github.com/mswjs/socket.io-binding) fornece handshake e codec. O mock complementa heartbeats Engine.IO `2`/`3`, fecha transportes nos cenários de desconexão e mantém a simulação de pagamentos na camada de rede. Timers do mock processam pedidos; nenhum timer de componente fabrica uma confirmação. O timer existente de expiração de cotação continua apenas representando seu prazo real.

`main.tsx` aguarda `worker.start()` e só depois importa o router. Isso também adia a avaliação de `socket.io-client` e sua captura do construtor WebSocket até o interceptor estar instalado. A mesma ordem é usada no build. `VITE_ENABLE_MSW=false` remove toda a simulação; `VITE_SOCKET_URL` permite configurar uma origem Socket.IO externa, sem alterar o transporte da aplicação.

## Conexão e sessão

`RealtimeLifecycle` acompanha a sessão no layout compartilhado. `services/realtime.ts` possui a conexão, listeners, estado técnico e reconciliação. Navegar entre rotas não cria uma nova conexão. Cada cliente usa um Manager exclusivo (`forceNew`), sem multiplexar sessões anteriores.

Após o handshake, o cliente envia `session.subscribe` com a credencial opaca em memória. O mock valida a credencial com a mesma base/expiração do REST e responde `session.ready`, incluindo userId/sessionId (ou null para visitante). Somente depois dessa confirmação há subscription válida. Conexões de visitantes recebem apenas eventos públicos de NFT.

Na primeira subscription, consultas HTTP em andamento e seus retries não são cancelados. Somente caches já carregados e ociosos são revalidados. Uma reconexão real cancela e revalida os recursos relevantes para recuperar eventos perdidos. O mock conserva o registro expirado da credencial até emissão/logout, para verificações concorrentes de Socket e REST retornarem consistentemente `SESSION_EXPIRED` em vez de disputar a remoção do registro.

Eventos privados são enviados somente ao peer autenticado do usuário/sessão correspondente. O mock revalida a sessão antes do envio. O cliente verifica geração da autenticação, usuário, sessão, recurso, versão e identidade do snapshot. Logout, expiração ou troca de usuário executam cleanup imediatamente pela infraestrutura de autenticação: listeners removidos, socket desconectado, subscriptions eliminadas e cache privado anterior descartado. A geração capturada impede callbacks atrasados de restaurar dados antigos, mesmo antes do React terminar de desmontar.

## Eventos

```ts
type NftUpdate = {
 eventId: string
 resourceId: string
 version: number
 updatedAt: string
 payload: { priceEth: string; availableQuantity: number | null }
}
type OrderUpdate = {
 eventId: string
 resourceId: string
 version: number
 updatedAt: string
 userId: string
 sessionId: string
 payload: Order // snapshot persistido pela API simulada
}
```

`nft.updated` representa uma alteração já persistida no banco mock. Preços ETH continuam strings decimais e todos os cálculos seguem em BigInt/wei. As classificações e metadados das fixtures não são inferidos ou alterados. Nenhum estoque foi criado: disponibilidade dos NFTs atuais continua null.

`order.updated` carrega o pedido autoritativo, incluindo seu snapshot de cotação. O mock usa a mesma função transacional do REST para confirmar/recusar e reconciliar o carrinho **antes** de emitir. `confirmed` e `refused` continuam terminais; somente `pending` pode transicionar. A regra de remoção por identidade da linha/quantidade e o marcador de reconciliação permanecem os da etapa de checkout, inclusive após receber duplicatas ou recarregar.

## Versões, cache e cotação

NFTs começam na versão 1. Alterações persistidas incrementam sua versão e a versão dos carrinhos que contêm o NFT. Catálogo, detalhe, favoritos, carrinho e cotação leem esse mesmo estado persistido; recibos antigos continuam isolados por cópia profunda.

O cliente ignora IDs de evento já recebidos e versões menores/iguais à maior versão conhecida (eventos ou cache REST). IDs recentes são limitados a 1024 por conexão; o controle de versão continua protegendo recursos depois de remover um ID antigo. Eventos privados estrangeiros são rejeitados antes de avançar seus controles de versão.

Para NFTs, o evento invalida imediatamente a cotação pela versão contida em cada item do snapshot. O botão de compra fica indisponível. Queries de catálogo/detalhe/carrinho/favoritos são canceladas e revalidadas via REST, preservando busca, filtros, ordenação e paginação corretos; não se tenta recalcular listas filtradas a partir de um evento parcial. O usuário precisa solicitar nova cotação e clicar novamente na confirmação. A API continua revalidando condições mesmo se o evento tiver sido perdido.

Para pedidos, o snapshot completo permite atualizar diretamente a query privada de pedido se a versão for mais recente e o estado atual ainda não for terminal. Lista de pedidos e carrinho são invalidados quando necessário. Não existe remoção otimista do carrinho, criação de recibo ou confirmação baseada apenas no relógio do cliente.

## Reconexão e polling

O Manager do Socket.IO faz reconexão com intervalo determinístico de 500 ms a 2 s, sem jitter. Desconexão remove a condição de subscription pronta. Após novo `session.ready`, queries relevantes são canceladas e invalidadas: catálogo/detalhe e recursos privados da sessão atual, incluindo pedidos pendentes. A aplicação não presume replay de eventos. REST é a fonte autoritativa para recuperar mensagens perdidas e estados confirmados durante a desconexão.

Eventos são o mecanismo principal. O polling existente fica como watchdog: 2500 ms enquanto conectado e 750 ms quando desconectado; estados terminais e erros interrompem o polling. O intervalo conectado mantém recuperação de um evento perdido e preserva os fluxos existentes de erro/retry. Um evento normal de pagamento chega antes desse watchdog. Mesmo numa corrida entre GET e evento, versões e estados terminais impedem regressão; o efeito no carrinho ocorre uma única vez no mock.

No cenário `pending`, a resolução automática fica suspensa. `error500`, `offline` e `timeout` do checkout também pausam a emissão automática, permitindo exercitar recuperação REST sem um evento esconder o erro esperado.

## Cenários reproduzíveis

O endpoint **exclusivo da camada de mocks** `POST /api/__scenarios/realtime` recebe `{command,args}`. Não é endpoint de negócio, não existe quando os mocks estão desativados e não tem botões na interface. Funciona também no build de demonstração. Por exemplo, no console do navegador:

```js
await fetch('/api/__scenarios/realtime', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ command: 'nft', args: ['emerald-ape-042', '1.29', 'normal'] })
})
```

Esse fetch é um comando administrativo de cenário; componentes e serviços de dados da aplicação continuam usando Axios. O endpoint altera o estado mock e envia frames pela conexão MSW/Socket.IO. Os testes nunca chamam handlers do cliente nem setters/cache para fingir receber um evento.

| Comando | Args / comportamento |
| --- | --- |
| diagnostics | Sem args; quantidade de peers/subscriptions e identidades mock inscritas |
| nft | `[id, priceEth, delivery]`; `normal`, `duplicate`, `old`, `out-of-order`, `lost` |
| order | `[orderId, outcome, delivery]`; outcome `confirmed`/`refused`; delivery `normal`, `duplicate`, `old`, `foreign`, `old-session`, `lost` |
| disconnect | Fecha transportes atuais; Socket.IO tenta reconectar |

`out-of-order` persiste duas versões de NFT e entrega a mais recente antes da anterior. `old` envia uma versão anterior com outro eventId. `lost` persiste a mudança sem emitir. `foreign` e `old-session` enviam envelopes incompatíveis intencionalmente para validar a rejeição do cliente; são controles adversariais de teste, não comportamento normal do servidor.

`localStorage.setItem('kurio:realtime-scenario', 'disconnected')` mantém peers desconectados; `connection-error` simula indisponibilidade na subscription. Retornar para `success` permite reconexão automática. Para recusar um pagamento automático, usar o cenário existente `kurio:checkout-scenario=payment-refused`. Sem configuração, a conexão normal confirma pagamentos pela simulação persistida.

Valores novos de preço desses comandos são condições sintéticas explícitas dos cenários solicitados; não novos dados do Figma. Reset completo: limpar a base `kurio:mock-auth-db:v1`, credenciais/cenários/tentativas/identidade visitante conforme AUTH/COMMERCE/CHECKOUT e **recarregar a página** para reiniciar também os controles de versão e conexões.

## Build, limitações e testes

O mock roda no navegador com MSW e o binding, sem servidor Socket.IO real. Cada aba tem seu mock de transporte; a persistência local sustenta refresh. Não há infraestrutura distribuída, rooms, namespaces personalizados, autenticação de uma blockchain ou garantia de broadcast entre navegadores/abas distintos. O binding não implementa toda a API de um servidor Socket.IO; este fluxo usa namespace padrão e eventos JSON, sem frames binários ou ACKs de aplicação. O cliente utilizado continua sendo o socket.io-client real.

`npm run build` gera os mocks no bundle de demonstração. `npx playwright test --config=playwright.preview.config.ts` testa o dist servido por Vite preview em 414 e 1440, exercitando subscription Socket.IO e atualização de catálogo/detalhe sem importar fontes de desenvolvimento. A suíte normal preserva os testes existentes e adiciona conexão, eventos, cotação obsoleta, terminalidade, duplicatas, versões antigas, ordem invertida, desconexão/perda/reconciliação, refresh, cleanup e isolamento nas quatro larguras.

README, assets, tipografia e estilos aprovados não foram substituídos. Perfil/carteiras editáveis, animações finais, Lighthouse e deploy continuam fora desta etapa.

## Validação concluída em 23/10/2026

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.
- Suíte completa: **380/380 aprovados**, sendo 95 em cada largura 390, 414, 768 e 1440 px. São os 320 testes anteriores preservados e 60 novos de tempo real. Duração Playwright: **58min26s**; 380 tentativas, zero retries, flaky, skipped ou erros globais.
- `npm run test:e2e:preview`: **2/2 aprovados**, em 414 e 1440 px, sobre o build final, em 23,4s.
- Os 91 arquivos de código/testes/configuração acompanhados permaneceram idênticos durante a execução completa. Hash do README original preservado: `208FF2613E6E3AC4330A40CEFC8610DFC469866167842C480BCB9B6FC5E08B8A`.
- Nenhum evento de suspensão/retomada do Windows foi registrado no intervalo da suíte completa.

Relatórios locais: `.artifacts/realtime-verified/playwright.json`, `summary.json`, `html-report/index.html`, `integrity.json` e `power-events.json`. O build estático tem log em `.artifacts/realtime-preview-final.log`.

Durante a implementação, o refresh em StrictMode revelou um transporte iniciado antes do cleanup; a conexão passou a abrir em microtask protegida pela geração/sessão. O cenário de expiração revelou uma consulta de pedido recriada durante o redirecionamento; ela agora verifica a sessão atual e é coletada ao desmontar. Uma primeira rodada completa foi interrompida após quatro regressões de asserção: a reconciliação inicial gerava requisições extras nos testes de erro/404, e verificações concorrentes de Socket/REST disputavam o motivo de expiração. As correções estão descritas acima. Os seis cenários relacionados passaram em duas repetições cada (12/12) antes da execução completa final. Nenhum teste existente foi enfraquecido ou alterado, e nenhum retry automático foi habilitado para esconder essas falhas.

## Arquivos desta etapa

Criados:

- `src/types/realtime.ts`
- `src/app/realtime-lifecycle.tsx`
- `src/services/mocks/realtime-handlers.ts`
- `src/services/mocks/market-store.ts`
- `tests/e2e/realtime.spec.ts`
- `tests/preview/realtime.spec.ts`
- `playwright.preview.config.ts`
- `REALTIME.md`

Alterados:

- `src/services/realtime.ts`
- `src/services/auth.ts`
- `src/services/mocks/auth-handlers.ts`
- `src/services/mocks/auth-store.ts`
- `src/services/mocks/catalog-fixtures.ts`
- `src/services/mocks/nft-detail-fixtures.ts`
- `src/services/mocks/commerce-store.ts`
- `src/services/mocks/commerce-handlers.ts`
- `src/services/mocks/checkout-store.ts`
- `src/services/mocks/handlers.ts`
- `src/types/catalog.ts`
- `src/main.tsx`
- `src/components/layout.tsx`
- `src/features/checkout/use-checkout.ts`
- `src/features/checkout/checkout-preview.tsx`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `ARCHITECTURE.md`
