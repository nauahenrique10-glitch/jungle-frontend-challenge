# Revisão visual — Kurio

Atualização: a família do Figma foi confirmada como Roboto Mono e integrada localmente nos pesos 400/500/700. As observações históricas abaixo sobre a fonte ausente foram resolvidas; tokens, licença e escopo da alteração estão em [TYPOGRAPHY.md](TYPOGRAPHY.md).

Escopo: fidelidade das nove páginas, sem negócio, autenticação, API/MSW ou tempo real. README e as 15 PNGs preservados. Referências lidas visualmente nesta rodada: nove Desktop e seis Mobile. As visões gerais de imagens longas são reduzidas pelo visualizador; esta revisão não afirma equivalência pixel a pixel, nem substitui baselines de regressão.

## Comparação por tela

| Tela | Referência desktop e correção | Referência mobile e correção | Diferenças intencionais / dependências |
| --- | --- | --- | --- |
| Início | Cabeçalho central, hero de 450 px, lateral de 310 px, grade de três colunas, destaque, paginação, dois banners, quatro editoriais e rodapé. Recalibrados paleta, alinhamento dos links e grupos do rodapé. | Busca em y=40, hero em y=101, duas colunas alternadas, miniatura sobreposta, favorito desabilitado no primeiro card e ícones preenchidos na barra inferior. Mantida reserva da barra + elevação + safe area. | Rótulos e contagens legíveis transcritos nesta rodada; ações permanecem desabilitadas. Roboto Mono confirmada. |
| Detalhe | Galeria com quatro miniaturas, painel da arte, informações, ações, metadados, seção descritiva, cinco artes relacionadas e rodapé. | Arte grande com painel sobreposto, voltar/favoritar, edição/metadados e bloco inferior de quantidade/compra; sem reaproveitar a grade desktop reduzida. | Mesma arte nas miniaturas, pois não há vistas alternativas; nenhum NFT é carregado pelo identificador. Dados e avaliação permanecem indisponíveis. |
| Carrinho | Três posições visuais, cabeçalhos de colunas, quantidade/remoção desabilitadas, cupom/resumo à direita, relacionados. | Quatro posições com arte de 100 px, cartões arredondados e resumo em painel inferior. | São posições ilustrativas de composição, não itens efetivos ou carrinho persistido. Quantidades, preços e totais são traços. |
| Pagamento | Campos de perfil em duas colunas e resumo/carteira à direita. | Duas posições de carteira, três provedores, total indisponível e botão inferior. | Nenhuma carteira está conectada ou selecionada. Endereço, rede e valores não são inventados; campos e confirmação desabilitados. |
| Confirmação | Painel central de 578 px com faixa inferior cobre, envelope, metadados em quatro colunas, três posições visuais e totais. | Painel adaptado com metadados em duas colunas, sem frame mobile específico. | Nunca apresenta compra concluída, transação, data ou recibo fictício. Exibe “Nenhum pedido confirmado”; exploração desabilitada. Ícone Lucide substitui a ilustração original de agradecimento. |
| Login | Painel sobre o início real renderizado em React e marcado inert/aria-hidden; tabs, campos, recuperação de senha, botão e provedores. Não é screenshot nem diálogo funcional. | Página independente com marca, título, campos de 50 px, botão de 60 px e links entre as páginas existentes. | Sem credenciais preenchidas, autenticação ou recuperação de senha. Letras decorativas G/f aproximam os provedores; logos originais não fornecidos. |
| Cadastro | Mesma composição do login com quatro campos e painel mais alto. | Formulário independente conforme o frame mobile, sem header/footer desktop. | Sem formulário funcional, validação ou persistência. |
| Perfil | Lateral de 310 px, campos em duas colunas, avatar e senha em coluna de meia largura, botão salvar. | Navegação compacta de perfil/carteiras e campos em uma coluna. Sem frame mobile específico. | Nenhuma sessão/perfil/avatar carregado. Ações desabilitadas; adaptação mobile não pode ser comparada a um frame inexistente. |
| Carteiras | Lateral compartilhada, dados da carteira principal, campos em duas colunas, carteira secundária e ações. | Mesma navegação compacta e campos em uma coluna, sem frame mobile específico. | Sem carteiras cadastradas, endereços ou rede selecionada. |

## Tokens e assets

As cores de áreas sólidas foram conferidas por frequência de pixels das PNGs: fundo `#140D0A`, painel `#241612`, cobre `#D28A4C`, creme `#F5F1EB`, bordas `#3F2319`, faixa do rodapé `#38220F`. Gradientes, textos secundários e suavização ainda são aproximações visuais.

As quatro artes de `public/assets/nfts/` permanecem intactas. O componente NftArtwork continua responsável por dimensões, recortes, lazy loading e alternativas textuais. Não há screenshots das referências na interface.

Fonte confirmada e aplicada: Roboto Mono local, pesos 400/500/700, licença OFL em licenses/RobotoMono-OFL.txt. Faltam a marca vetorial, logos oficiais dos provedores e eventual ilustração do recibo. A galeria precisa de assets alternativos para mostrar vistas distintas. Informações de conta/pedidos continuam indisponíveis.

## Refinamento final de Home e Login

Hero desktop recalibrado para 42/68 px, mantendo o bloco, a arte e os indicadores. Login mantém o painel medido de 500 × 600 px; intro reduzida para 12/16 px, tabs 20/26 px, botões de 40 px e intervalo de 12 px entre provedores. Estilos restritos ao desktop e ao Login, sem alterar Cadastro ou composição mobile.

Nomes e preços da Home foram transcritos dos frames, mediante autorização: Emerald Ape #042 (1.19), Sage Nomad #009 (1.69), Neon Vessel #552 (1.99; anterior 2.29), Cosmic Bloom #118 (1.29), Violet Nomad #314 (1.39), Ivory Baron #088 (1.79), Golden Beat #207 (0.99), Golden Frequency #071 (0.59), Golden Signal #160 (0.39), todos em ETH. A quarta posição mobile usa Golden Beat, acompanhando a arte já integrada. São rótulos estáticos de design, sem disponibilidade, cálculo ou consulta.

Validação final: TypeScript e build aprovados; 36 testes Playwright passaram em execução serial (390, 414, 768 e 1440 px). Sem overflow detectado ou perda de acesso ao rodapé pela navegação fixa, incluindo safe area simulada. Inspecionadas capturas finais de Home desktop completa/viewport, Login desktop e Home mobile 390/414. Não há comparação automática com baseline versionada; as diferenças residuais de enquadramento das artes, geometria do fundo mobile, marca e logos de provedores não são eliminadas por esses testes.

Incluídos contadores de coleções/redes legíveis, faixa 0,02–12,30 ETH e paginação visual 1–4/próxima desabilitada. Destaque usa OFERTA LIMITADA, com arte mais compacta. Banners e Diário receberam os trechos editoriais legíveis, sem criar artigos ou destinos. O segundo banner termina em “digitais que definem a”: o restante está encoberto no frame e não foi completado por suposição. As quatro artes e o README permanecem intactos. As observações antigas sobre ausência de nomes/preços na Home estão superadas por esta rodada.

## Verificação

TypeScript e build de produção; Playwright em Chromium 390/414/768/1440. A suíte inclui a base e oito previews por largura (36 testes), ausência de overflow, imagens carregadas, campos desabilitados, ausência de pedido confirmado, console sem erros e reserva da bottom navigation com safe area simulada de 24 px no início. Nas demais páginas a bottom navigation fica oculta, seguindo os frames mobile, portanto não encobre os controles.

Capturas viewport e completas são geradas em `test-results/`, relatório em `playwright-report/`. Capturas de todas as páginas foram inspecionadas durante a rodada; correções posteriores incluíram topo da galeria/carrinho, alinhamento de navegação, espaçamento do pagamento, altura do recibo, campos de carteiras e margem colapsada no fundo da autenticação. Ainda não há baselines versionadas nem auditoria Lighthouse; testes aprovados não equivalem a fidelidade perfeita.
