# Kurio — base da etapa 1

Atualização de favoritos/carrinho: favoritos autenticados e carrinhos visitante/usuário usam REST/MSW, Axios e TanStack Query, com rota protegida /favoritos, mesclagem transacional no login/cadastro e valores em wei. [COMMERCE.md](COMMERCE.md) documenta contratos, cupons demonstrativos, isolamento e limitações. Checkout, pagamento, pedidos e Socket.IO continuam fora do escopo; as observações históricas de carrinho totalmente provisório abaixo estão superadas.

Atualização de autenticação/sessão: login, cadastro, logout e recuperação/expiração agora usam REST/MSW, Axios, TanStack Query e guardas do Router. Perfil/carteiras são protegidos e somente leitura. [AUTH.md](AUTH.md) registra credenciais fictícias, derivação das senhas, estrutura persistida, endpoints, cenários e isolamento por usuário/sessão/geração. As observações históricas de autenticação totalmente provisória abaixo estão superadas; demais etapas de negócio permanecem fora do escopo.

Atualização do detalhe: `/nfts/$nftId` consulta o endpoint MSW por Axios/TanStack Query, com 404, retry, skeletons, edição/quantidade na URL e contexto do catálogo. [NFT_DETAIL.md](NFT_DETAIL.md) registra o contrato, transcrições dos frames, rede Ethereum confirmada somente para Emerald Ape e limitações. O detalhe deixou de ser uma prévia estática; outras telas de negócio continuam provisórias.

Atualização funcional do catálogo: Home usa Axios → HTTP/MSW, TanStack Query e estado de URL validado pelo TanStack Router. O contrato, fixtures confirmadas, cenários, políticas de cache/concorrência e limitações estão em [CATALOG.md](CATALOG.md). Essa documentação substitui as observações históricas abaixo sobre handlers vazios, worker não iniciado e catálogo desabilitado. As demais etapas de negócio continuam provisórias; nenhum estoque ou classificação foi inferido.

O README.md original permanece inalterado. Esta etapa entrega somente a base executável e visual; não representa a conclusão do desafio.

Atualização tipográfica: o usuário confirmou Roboto Mono como a família do Figma. Agora ela é servida localmente via Fontsource nos pesos 400/500/700, com Body/15 Regular 15/15 px e licença preservada. [TYPOGRAPHY.md](TYPOGRAPHY.md) documenta os tokens e substitui as observações históricas abaixo sobre a fonte original não identificada.

Atualização da rodada final de fidelidade: as oito rotas além do início agora renderizam prévias visuais próprias, com campos/ações desabilitados, sem lógica de negócio. `src/components/visual-preview.tsx` fornece primitivas compartilhadas; as composições ficam em `features/nft`, `features/cart`, `features/checkout` e `features/account`. `src/styles/visual-previews.css` contém os estilos correspondentes. O estado atual e a comparação das 15 referências estão documentados em [VISUAL_REVIEW.md](VISUAL_REVIEW.md); descrições abaixo da base original devem ser lidas com essa atualização. Nenhum preço, identidade, sessão, pedido confirmado ou integração foi criado.

## Execução

Node.js 22.12+ (validado com Node 24), npm e `npm ci`. Inicie com `npm run dev` e abra a URL indicada pelo Vite. Variáveis opcionais em `.env.example`; nenhum backend é necessário para esta etapa. `npm run typecheck`, `npm run build`, `npm run preview` e `npm run test:e2e` estão disponíveis. Para instalar Chromium: `npx playwright install chromium`.

## Responsabilidades

- `src/app`: Router, QueryClient e composição de providers.
- `src/routes`: estados provisórios, incluindo rota inexistente.
- `src/components`: layout, placeholders e componentes shadcn/ui locais.
- `src/features/catalog`: composição visual inicial do início.
- `src/services`: cliente Axios, factory Socket.IO e preparação MSW.
- `src/styles`: tokens Kurio, Tailwind v4 e estilos responsivos.
- `src/types`: contratos iniciais de NFT, ETH e envelope de eventos.
- `tests/e2e`: smoke test da base em Chromium, 390, 414, 768 e 1440 px. Não substitui os E2E de negócio exigidos no README.

React/TypeScript com Vite; Tailwind usa o plugin Vite [oficial](https://tailwindcss.com/docs/installation/using-vite). shadcn/ui segue a [instalação manual](https://ui.shadcn.com/docs/installation/manual), com Button local, Slot Radix, CVA, clsx, tailwind-merge e aliases em components.json. Ícones Lucide SVG. Versões exatas instaladas ficam no package-lock.json.

TanStack Router define `/`, `/nfts/$nftId`, `/carrinho`, `/pagamento`, `/confirmacao`, `/login`, `/cadastro`, `/perfil`, `/carteiras`. Todas as telas além do início são explicitamente provisórias e não consultam dados privados. Guardas de sessão só serão implementadas com a API simulada. A confirmação não gera recibo ou mensagem de compra concluída.

QueryClient ativo no provider: staleTime 30 s, refetch ao focar, retries desativados para queries e mutations. Não há consultas fictícias para demonstrar uso. A próxima etapa deve adicionar queries via Axios, AbortSignal, chaves por usuário/parâmetros e políticas de invalidação. Nenhum estado financeiro usa Number no contrato: ETH permanece string decimal.

MSW tem handlers vazios e worker não iniciado. Nenhum service worker foi registrado, nenhum cenário foi inventado. A etapa de integração deve adicionar bootstrap por configuração, handlers REST, fixtures compartilhadas e persistência/reset determinísticos. Socket.IO tem factory com autoConnect false, sem listeners ou emissão. A próxima etapa deve usar transporte compatível com MSW (por exemplo socket.io-binding), documentar limitações, filtrar versões/duplicatas, reconciliar REST após reconexão e liberar listeners/cache por sessão.

## Inspeção visual e limitações

README lido integralmente; todas as 15 PNGs visualizadas antes de implementar: Desktop (Cadastro, Carrinho de NFTs, Carteiras, Confirmação de Pedido, Detalhes do NFT, Início, Login, Pagamento, Perfil do Colecionador) e Mobile (Cadastro, Carrinho de NFTs, Detalhes do NFT, Início, Login, Pagamento). Imagens desktop longas foram reduzidas pelo visualizador na visão geral; a composição e hierarquia foram observadas, sem afirmar medição pixel a pixel. Não foi necessário acessar o arquivo Figma remoto.

Referências: fundo preto amarronzado, painéis marrons, cobre nos destaques, creme nos textos, fonte monoespaçada; contêiner desktop de aproximadamente 1200 px em tela de 1440 px; catálogo com lateral e três colunas; mobile com duas colunas e navegação inferior. Tokens são aproximações visuais, não valores extraídos do Figma. O rodapé reproduz grupos e faixas principais; informações auxiliares sem implementação aparecem como texto ou indisponibilidade. Na página inicial mobile, o cabeçalho fica oculto, como na referência. A navegação inferior mantém início, carrinho e perfil e apresenta favoritos e scanner desabilitados com nomes acessíveis que informam a indisponibilidade.

Nenhum PNG completo foi usado na interface. O repositório não oferece assets individuais ou fontes. A fonte de sistema Consolas, com fallback Liberation Mono/monospace, substitui temporariamente a fonte original, cuja família não foi identificada com segurança. Ela aproxima o desenho sem as serifas de Courier, mas a renderização depende do sistema operacional até obter a fonte original. Placeholders estáticos são identificados, não skeletons de carregamento. Hero e nove posições do catálogo não representam NFTs cadastrados. Não há preços, avaliações, contadores ou estoque inventados. Busca, filtros e ordenação desabilitados até integração. Foco visível, skip link, labels, semântica e preferência de movimento reduzido estão previstos.

Após autorização da correção visual, foram incluídos dois banners e quatro posições editoriais no Diário da Cunhagem. Títulos promocionais e descrição da seção vêm da referência; textos e imagens de artigos seguem explicitamente pendentes, sem autores, datas ou tempo de leitura inventados. A paginação tem controles desabilitados sem total/página atual fictícios. Indicadores do hero são decorativos, sem carrossel simulado. A faixa de preço é uma representação decorativa sem valores ou comportamento. O aviso de indisponibilidade do catálogo foi movido para seu final, associado à seção por aria-describedby, preservando a composição do primeiro viewport. O hero mobile usa texto específico, miniatura placeholder sobreposta e fundos CSS decorativos, nunca screenshots.

A revisão preserva a arquitetura e os componentes Button/ArtworkPlaceholder; HomeSections compõe PromotionCard e JournalCard reutilizáveis. Estilos básicos ficam em @layer base para não sobrepor cores/pesos das classes Tailwind nos botões como links. Catálogo e barra inferior usam proporções próprias para mobile. O rodapé continua uma adaptação parcial: contatos, links editoriais/sociais e funcionalidades auxiliares não foram inventados. Assets individuais, fonte original e conteúdo aprovado continuam necessários para fidelidade completa.

## Assets necessários

### Atualização: integração das quatro artes originais

As artes agora estão disponíveis em `public/assets/nfts/`: `emerald-ape.png` (900×900), `sage-nomad.png`, `ivory-baron.png` e `golden-beat.png` (500×500). Os nomes recebidos com extensão duplicada `.png.png` foram normalizados, sem modificar o conteúdo dos arquivos. A lista abaixo registra a necessidade original; as quatro artes já suprem todas as posições visuais da página inicial por reutilização conforme a referência.

`NftArtwork` centraliza caminhos, dimensões e alternativas textuais. Usa imagem principal prioritária no hero, lazy loading nas demais posições e picture/source para a quarta posição do catálogo: Sage no desktop, Golden no mobile. As nove posições desktop usam Emerald, Sage, Ivory, Sage, Sage, Ivory, Golden, Golden, Golden. Não são registros de API ou associações de negócio: títulos e preços provisórios foram preservados.

Emerald ocupa hero desktop/mobile, primeiro card, primeiro banner e segundo card editorial. Sage ocupa a miniatura sobreposta mobile, cards 2/4/5 desktop, destaque lateral e terceiro editorial. Ivory ocupa cards 3/6, segundo banner e primeiro editorial. Golden ocupa cards 7/8/9, quarta posição mobile e quarto editorial. Hero e cards preservam proporção quadrada e recorte central; destaque lateral usa crop vertical; banners usam cover/top; editorial usa cover com posição vertical de 30%. A miniatura mobile é decorativa e sobreposta sem borda artificial.

TypeScript, build de produção e os quatro projetos Playwright (390/414/768/1440) foram executados na integração. Os testes validam também o carregamento de todas as imagens visíveis, inclusive lazy loading ao rolar a página, e a imagem responsiva da quarta posição. Capturas desktop e mobile foram inspecionadas. Permanecem pendentes fonte original/licença, eventual marca vetorial, assets de galeria não fornecidos e conteúdo editorial aprovado. Nenhum PNG completo das referências é usado na interface.

- Arte do hero Kurio (desktop/mobile), incluindo composição mobile com miniatura.
- Artes individuais dos nove itens do catálogo: Emerald Ape #042, Sage Nomad #009, Neon Vessel #552, Cosmic Bloom #118, Violet Nomad #314, Ivory Baron #088, Golden Beat #207, Golden Frequency #071 e Golden Signal #160.
- Galeria/miniaturas do NFT e artes de recomendações/destaques para próximas etapas.
- Fonte monoespaçada original e licença; marca vetorial Kurio se disponível (atualmente wordmark textual).

## Verificação desta etapa

Após a correção visual, `npm run typecheck` e `npm run build` passaram com Vite 7.3.7. `npm run test:e2e` passou nos quatro projetos Chromium (390, 414, 768 e 1440 px), verificando início, ausência de overflow horizontal no início, navegação ao catálogo, acesso direto às oito rotas provisórias e rota inexistente. Também verifica presença de banners e diário, paginação desabilitada, texto escuro do CTA desktop e hero mobile com até 220 px, sem cabeçalho e com scanner desabilitado. Capturas de início desktop/tablet/mobile foram inspecionadas; screenshots em `test-results/` e relatório em `playwright-report/` são artefatos locais ignorados pelo Git, ainda sem baselines de regressão. Build e navegador exigiram execução fora do sandbox devido a spawn EPERM. Lighthouse e E2E de negócio não foram executados nesta etapa.

## Requisitos preservados para próximas etapas

Os eliminatórios continuam obrigatórios na entrega final: stack com uso efetivo, fluxos completos além de visuais, compra confirmada apenas pela simulação, isolamento entre usuários, eventos pela rede Socket.IO (nunca setters diretos da UI) e E2E executáveis. Nesta base Query/Axios/MSW/Socket.IO ainda não entregam fluxos de negócio.

Pendentes: contratos REST completos, sessão e guards, URL de busca/filtros/paginação, cenários MSW e binding Socket.IO, cache isolado, favoritos com atualização otimista/rollback, carrinho persistente, cotação precisa, idempotência e snapshot de recibo, reconexão/versões, formulários, skeletons shimmer e estados assíncronos, regressão visual com baselines, E2E de todos os cenários e Lighthouse (três execuções por página/perfil). O README exige deploy na entrega final; nenhum deploy faz parte desta etapa. Documentação de setup complementar fica aqui para preservar o README original.


## Atualização: checkout e pedidos simulados

O fluxo de checkout, cotação, carteira simulada, pedido idempotente, polling REST e recibo agora está implementado. Os contratos, fontes dos dados de carteira, cenários MSW, reconciliação de quantidades e limitações estão em [CHECKOUT.md](CHECKOUT.md). Os registros de etapas anteriores acima são históricos; catálogo, detalhe, sessão, favoritos e carrinho continuam funcionais.

Pedidos têm versão e estados terminais imutáveis. Confirmação e reconciliação ocorrem na camada MSW, nunca por temporizador da interface. Socket.IO, edição de perfil/carteiras, Lighthouse e deploy permanecem fora desta etapa.

## Atualização: tempo real

Socket.IO agora transporta `nft.updated` e `order.updated` pelo interceptor WebSocket do MSW com `@mswjs/socket.io-binding`. O bootstrap aguarda o MSW antes de carregar o cliente Socket.IO. Um ciclo de conexão por sessão controla subscriptions, cleanup, versões e descarte de eventos privados incompatíveis. TanStack Query recebe invalidações públicas e snapshots privados versionados; reconexão reconcilia com REST. Polling de pedido permanece como recuperação, com intervalo menor quando desconectado. A arquitetura, cenários, testes e limitações estão em [REALTIME.md](REALTIME.md). Os parágrafos anteriores descrevem etapas históricas.

## Atualização: perfil e carteiras

Perfil, avatar, troca de senha e cadastro/edição de carteiras agora usam os serviços Axios, TanStack Query e handlers MSW com persistência por proprietário. Carteiras alimentam também o checkout; recibos antigos conservam seus snapshots. Avatar é validado e persistido apenas na base mock local; senhas usam o verificador PBKDF2 existente. Contratos, cenários, regras de prioridade, isolamento e limitações estão em [ACCOUNT.md](ACCOUNT.md). Os registros anteriores de edição indisponível são históricos.
