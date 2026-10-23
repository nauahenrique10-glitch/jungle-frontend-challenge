# Tipografia Kurio — Roboto Mono

A família Roboto Mono foi confirmada pelo usuário para o token `font/family` do Figma. A comparação de famílias alternativas foi encerrada; IBM Plex Mono e Space Mono não foram instaladas.

## Distribuição e licença

Roboto Mono é fornecida por `@fontsource/roboto-mono`, com versão exata no package-lock.json. Os arquivos são importados em `src/main.tsx` e servidos pela própria aplicação, sem requisições ao Google Fonts ou a outra CDN durante a execução. O build do Vite gera arquivos de fonte com hash. Foram importados somente os subconjuntos Latin normais dos pesos 400, 500 e 700, que cobrem os caracteres portugueses utilizados.

Os CSS do pacote usam `font-display: swap`, WOFF2 com fallback WOFF. Fallback de sistema: monospace. A licença SIL Open Font License 1.1 e a atribuição integral estão preservadas em [licenses/RobotoMono-OFL.txt](licenses/RobotoMono-OFL.txt), copiadas do pacote sem alterações.

## Tokens e hierarquia

| Uso | Tamanho / entrelinha | Peso | Espaçamento |
| --- | --- | --- | --- |
| Corpo / Body/15 Regular | 15 / 15 px | 400 | 0 |
| Labels de formulário | 15 / 15 px | 400 | 0 |
| Hero desktop | 42 / 68 px | 700 | 0 |
| Navegação desktop | 16 / 16 px | 400; ativo 700 | 0 |
| Cards desktop: título | 15 / 20 px | 400 | 0 |
| Aba selecionada do catálogo | 14 px desktop | 500 | 0 desktop |
| Títulos de seção | 18–28 px; entrelinha própria | 700 | 0 |
| Tabs de login/cadastro desktop | 20 / 26 px login; 20 / 28 px cadastro | 700 | 0 |
| Botão principal de autenticação / hero desktop | 16 / 20 px | 700 | 0 |
| Título do hero mobile | 18 / 29 px | 700 | 0 |
| Texto do hero mobile | 12 / 18 px; 11,5 px em 390 | 400 | 0 |
| Título de login/cadastro mobile | 20 / 28 px | 700 | 0 |

Textos longos, descrições e rodapé mantêm entrelinhas explícitas para leitura e para não confundir o token compacto Body/15 com parágrafos de várias linhas. Tamanhos menores de metadados, avisos e conteúdo editorial foram preservados. A marca mantém o espaçamento visual observado nas referências. Botões e controles herdam a família; os tokens Tailwind `font-sans` e `font-mono` também usam Roboto Mono. As letras decorativas dos provedores agora herdam a mesma família.

## Limites da alteração

Nenhuma rota, componente de negócio, regra, texto, valor ou asset de NFT foi alterado. O README original permanece intacto. Não houve nova composição de layout. A única correção de largura é o limite do parágrafo do hero mobile de 184 para 188 px, necessário para preservar a quebra observada em 414 px após carregar a fonte correta; em 390 px o texto usa 11,5 px para manter a composição compacta. Os demais ajustes são de família, peso, tamanho, entrelinha e espaçamento de letras.

Os testes aguardam `document.fonts.load` e `document.fonts.ready` antes das capturas e verificam a família computada e o token Body/15. Playwright cobre as nove páginas em 390, 414, 768 e 1440 px, overflow e espaço da barra inferior. A inspeção visual das capturas é feita após o carregamento da fonte, não sobre o fallback.

Validação concluída: os 36 testes passaram com `npm run test:e2e -- --workers=1 --timeout=90000`. A execução serial evitou a instabilidade de criação de páginas observada na rodada paralela; a espera da fonte usa waitForFunction para tolerar recarregamentos do servidor de desenvolvimento e exige os três FontFace com status loaded. TypeScript e build de produção passaram; o bundle contém os três pesos WOFF2 locais de aproximadamente 13 KB cada. Nenhuma mudança de rota, funcionalidade, dados ou arte foi necessária.
