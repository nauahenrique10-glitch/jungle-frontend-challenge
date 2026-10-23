# Perfil e carteiras do Kurio

## Contratos REST

Todas as chamadas de negócio usam TanStack Query → serviços Axios → handlers MSW. As rotas `/perfil` e `/carteiras` continuam protegidas pelo TanStack Router e SessionGate.

| Endpoint | Contrato |
| --- | --- |
| `GET /api/account/profile` | Consulta existente; retorna `{userId,sessionId,profile}` |
| `PATCH /api/account/profile` | `{displayName,username,email,ens,walletNickname}`; devolve o perfil confirmado |
| `PUT /api/account/avatar` | Multipart FormData, campo `avatar`; devolve o perfil confirmado |
| `DELETE /api/account/avatar` | Remove o avatar e devolve o perfil confirmado |
| `POST /api/account/password` | `{currentPassword,newPassword,confirmPassword}`; devolve identidade e mensagem |
| `GET /api/account/wallets` | `{userId,sessionId,wallets,secondaryUsesPrimary}` |
| `POST /api/account/wallets` | Cadastra `WalletInput`; status 201 e coleção atualizada |
| `PATCH /api/account/wallets/:id` | Atualiza `WalletInput` ou recebe `{role:'primary'}` para promover; devolve coleção atualizada |
| `PATCH /api/account/wallet-preferences` | `{secondaryUsesPrimary:boolean}`; devolve a preferência persistida e coleção |

`ProfileInput`, `PasswordInput`, `WalletInput`, `AccountWallet`, `WalletsResponse` e erros estão em `src/types/account.ts`. Nenhum componente importa fixtures. Respostas privadas são verificadas por usuário e sessão antes de entrar no cache.

## Perfil e senha

Nome de exibição aceita 2–80 caracteres; username segue a regra existente de 3–24 letras, números, `_` ou `-`; e-mail/username são normalizados e têm unicidade sem distinção de caixa. ENS e apelido são opcionais: não se exige que usuários sem esses dados inventem um valor para salvar o perfil. ENS é validado sintaticamente como nome `.eth`, sem consulta a serviços externos.

O botão **Salvar** preserva a composição atual e envia apenas as operações alteradas. Dados do perfil e senha são recursos separados. Se o perfil for salvo e a senha for recusada, a interface informa explicitamente o sucesso parcial; não há transação atômica entre os dois endpoints. Campos de senha vazios não iniciam troca de credencial. Nova senha: 8–128 caracteres, diferente da atual e igual à confirmação.

A camada mock verifica a senha atual e deriva um novo verificador PBKDF2/SHA-256 com 600.000 iterações e salt aleatório, usando a infraestrutura de autenticação existente. Somente salt/verificador são persistidos. Não há senha em claro no localStorage, snapshots de pedidos ou sessão. Inputs são transitórios em memória e as variáveis das mutations são liberadas com reset/gcTime 0. Após trocar senha, a sessão atual permanece ativa; as demais sessões desse usuário são revogadas. A expiração é revalidada depois da derivação, antes de gravar.

Atualizações confirmadas sincronizam o cache de perfil e o usuário da sessão, sem mudar token, identidade técnica ou geração. Pedidos/recibos existentes mantêm seus snapshots; dados de uma carteira são editados separadamente dos dados do perfil.

## Avatar local

Aceita PNG, JPEG e WebP de até **512 KiB**, com dimensões até **4096 × 4096 px**. A UI verifica MIME/tamanho. O handler verifica novamente, confere a assinatura dos bytes e usa `createImageBitmap` para decodificar o conteúdo. SVG, texto renomeado como imagem, arquivos vazios, imagens inválidas ou excessivas são recusados.

O multipart é interceptado pelo MSW; não existe upload para serviço externo. Somente após validação o mock transforma a imagem em data URL e a grava no perfil do proprietário, na base mock existente. O preview usa a resposta confirmada. Remover define `avatarUrl=null`. Quota de armazenamento ou indisponibilidade de decodificação resultam em erro, nunca sucesso falso. Não há crop/edição, armazenamento em nuvem ou garantia de suporte a outros formatos.

## Carteiras e integração com checkout

Os dois registros de referência já utilizados pelo checkout foram preservados e agora pertencem à base persistida de cada usuário. Seus IDs, redes, rótulos e endereços de apresentação permanecem iguais. O endereço completo dessas referências continua **null**, pois não foi fornecido. Editar esses registros exige fornecer um endereço completo e tipo de carteira; o simulador não expande endereços truncados por suposição.

Uma carteira tem ID técnico estável, proprietário, versão, nome de exibição, apelido, rede, username, endereço, referência secundária opcional, provedor, código de indicação opcional, e-mail, ENS opcional e prioridade. Redes: Ethereum/Polygon; tipos: WalletConnect/MetaMask/Coinbase Wallet, já disponíveis no checkout. Endereços seguem a sintaxe EVM `0x` + 40 dígitos hexadecimais; não há validação on-chain, checksum obrigatório ou resolução real de ENS. Código de indicação é apenas metadado opcional, sem aplicar descontos.

Há uma principal e podem existir várias secundárias. Criar/promover uma principal reclassifica a anterior como secundária na mesma transação. Endereço repetido na mesma rede do mesmo usuário gera 409. IDs de outro usuário geram 404. A preferência **Igual à carteira principal** armazena uma referência à principal, sem duplicar seu endereço nem apagar carteiras existentes; não conecta carteiras automaticamente. O checkbox reflete a escolha durante o envio e faz rollback em erro. Apenas a resposta da API gera feedback de sucesso.

`GET /api/checkout/wallets`, conexões e cotações usam os mesmos registros persistidos, mantendo a ordem inicial de demonstração e a seleção explícita do checkout existente. Salvar/promover invalida conexões simuladas anteriores desse proprietário, exigindo nova conexão; o frontend invalida as queries de carteiras/quote. Recibos já emitidos continuam imutáveis.

## Isolamento, erros e concorrência

Queries usam `['private',userId,sessionId,generation,...]`. A consulta da lista de conta acrescenta `'account'` ao recurso wallets, para não confundir seu contrato com o do checkout. Mutations têm meta privada, sem retry e com lock para submissão repetida. Todos os HTTPs passam por `requestForSession`, que captura credencial/geração, cancela ao sair e rejeita respostas obsoletas. Callbacks validam novamente a geração antes de atualizar estado/cache.

A base usa o lock transacional já existente. Validações/conflitos são checados antes de gravar. Logout/expiração/troca de usuário removem cache e mutations privados. Uma operação já confirmada pelo mock pode permanecer para o proprietário antigo, mas nunca ser aplicada ao usuário seguinte.

Erros retornam `{code,message,fields?}`: 400 para validação/senha atual incorreta, 401 para sessão inválida/expirada, 403 para identidade incompatível, 404 para recurso inexistente/estrangeiro, 409 para e-mail/username/endereço em conflito, 413/415 para avatar excessivo/formato inválido e 500 para falha simulada/persistência local. Campos têm labels, aria-invalid, aria-describedby e foco; erros gerais usam alert, sucessos status. Drafts permanecem após erro.

## Cenários reproduzíveis

Configurar `localStorage.setItem('kurio:account-scenario', valor)` no navegador:

- `success`: padrão.
- `latency`: 1400 ms para observar loading e bloqueio de submits.
- `error500`: falha de consulta/mutation.
- `unauthorized`: expira a sessão na base e devolve 401.
- `validation`: erro 400 de servidor em mutations/listagem de carteiras.
- `offline`: erro de transporte nos novos handlers.

Conflitos, senha incorreta, recurso estrangeiro e avatar inválido são determinísticos pelos próprios dados enviados. A consulta de perfil existente continua respeitando também `kurio:auth-scenario`; os demais cenários acima são de conta. Para reset integral, limpar o armazenamento do site e recarregar, como nas etapas anteriores. Dados não são compartilhados entre navegadores nem sincronizados por um backend real.

## Interface e validação

Foram examinadas as referências Desktop/Perfil do Colecionador e Desktop/Carteiras. Não existem frames mobile específicos dessas telas no repositório; foi preservada a adaptação existente. O formulário mantém tipografia, superfícies, grid e navegação. Listas de carteiras e feedbacks foram acrescentados apenas para tornar os estados funcionais operáveis. ENS/código de indicação opcionais não exibem asterisco obrigatório.

Testes novos cobrem edição/refresh/login, conflitos e validação, avatar/tipo/tamanho/conteúdo/remoção, senha incorreta e nova credencial, cadastro/edição/prioridade/preferência de carteiras, erros 400/401/409/500, rollback, submits repetidos, isolamento persistido e resposta antiga. As verificações visuais existentes de perfil/carteiras agora exigem formulários habilitados em vez da antiga mensagem de indisponibilidade.

As consultas anteriores de perfil são canceladas antes de aplicar o resultado confirmado de uma mutation, evitando que uma leitura iniciada antes do salvamento sobrescreva o cache atualizado.

Na validação, duas asserções existentes do catálogo expuseram uma lacuna de sincronização: `page.goto()` aguarda o evento load do navegador, mas o bootstrap da aplicação ainda aguarda MSW/import do router e renderização. Os traces mostraram worker ativado, resposta 200 e cache success/idle, sem erro de transporte inesperado; as asserções de 5 segundos começaram antes da prontidão. O helper agora aguarda o contêiner da aplicação antes da asserção de estado carregado; o cenário vazio também aguarda e valida a resposta REST/MSW. Não houve aumento de timeouts, enfraquecimento das asserções ou alteração do catálogo. Os dois casos passaram em cinco repetições cada (10/10) após esse ajuste. Logs/traces das rodadas interrompidas foram preservados em `.artifacts/account-functional/full` e `verified`.

O mesmo problema de prontidão apareceu no helper positivo de login após uma senha atual incorreta: o erro 400 esperado, o novo login 200 e o perfil 200 estavam corretos, mas o helper já havia iniciado sua asserção enquanto o perfil carregava. Ele agora aguarda o POST e o GET de perfil da sessão correspondente e então verifica o e-mail na UI. O caso de senha e o de expiração automática passaram em cinco repetições cada (10/10). Não houve alteração no fluxo de autenticação nem nos seus timeouts. O trace dessa rodada está em `.artifacts/account-functional/complete`.

### Resultados da validação final

- `npm run typecheck`: aprovado, repetido após o último ajuste de teste.
- `npm run build`: aprovado; Vite concluiu em 21,41 s.
- Suíte integral: **432 testes, 428 aprovados e 4 falhas**, 81min13s, um worker, zero retries, zero skips e zero erros globais do runner. Cada largura 390/414/768 passou 108/108; 1440 passou 104/108. Os 13 novos cenários de conta passaram nas quatro larguras (**52/52**), incluindo isolamento, persistência, avatar, senha, validação e overflow. As capturas de perfil/carteiras em 390 e 1440 foram inspecionadas visualmente.
- Falhas integrais, todas em 1440: `catalog.spec.ts` — erro 500/retry; `checkout.spec.ts` — cotação/cupom/conexão, pagamento recusado e loading com latência. Não são apresentadas como aprovação integral.
- O trace do catálogo mostrou a aplicação ainda importando o router, antes de qualquer chamada `/api/nfts`, quando expirou a asserção de 5 s. O teste agora aguarda a segunda resposta 500 do MSW antes de verificar o alerta; preserva as contagens exatas de tentativas, a recuperação manual e o timeout original. No checkout, a tela ainda carregava: no cenário de cotação, GET `/api/orders` retornou 200 após cerca de 8,7 s. Não houve `net::ERR_FAILED` nos traces examinados; os abortos observados são de cancelamento/navegação/StrictMode. A causa específica do loading transitório não observado no quarto cenário não foi demonstrada.
- Verificação pontual posterior dos quatro casos: **4/4 aprovados**, 1min11s, sem retries. Apenas o teste de catálogo recebeu o ajuste acima; checkout permaneceu inalterado. Isso não substitui a rodada integral nem demonstra ausência de intermitência nos três testes de checkout. Não houve nova execução integral após esse ajuste.
- Smoke do build estático: **2/2 aprovados**, 26,1 s, larguras 414/1440.
- Hashes confirmam fontes/configuração/testes sem alterações durante a rodada integral. README, referências, assets e Roboto Mono preservados em relação ao inventário inicial. Nenhum evento de suspensão/retomada/energia inesperada foi encontrado no intervalo. O runner concluiu os 432 casos e gravou JSON; o servidor HTML aberto pelo reporter foi encerrado depois disso (por isso o wrapper registra exitCode -1, embora o JSON já contenha o resultado integral).

Evidências: `.artifacts/account-functional/validated/{playwright.json,summary.json,playwright.log,html-report,test-results,source-hashes.json,power-events.json}`, `.artifacts/account-functional/targeted.{json,log}`, `preview.log`, `typecheck-final.log` e `build.log`. Os traces das quatro falhas foram preservados. Permanece risco conhecido de flakiness nas esperas de checkout em ambiente sob carga; não foi mascarado com retries ou timeouts maiores.

Animações finais, revisão de ícones, Lighthouse e deploy não fazem parte desta etapa.

## Inventário de arquivos

Criados:

- `src/types/account.ts`
- `src/services/account.ts`
- `src/services/mocks/account-store.ts`
- `src/services/mocks/account-handlers.ts`
- `src/features/account/account-validation.ts`
- `src/features/account/account-fields.tsx`
- `src/features/account/use-account.ts`
- `src/features/account/profile-form.tsx`
- `src/features/account/wallets-form.tsx`
- `tests/e2e/account.spec.ts`
- `ACCOUNT.md`

Alterados:

- `src/features/account/account-preview.tsx`
- `src/services/mocks/auth-store.ts`
- `src/services/mocks/auth-handlers.ts`
- `src/services/mocks/handlers.ts`
- `src/services/mocks/checkout-store.ts`
- `src/services/mocks/checkout-handlers.ts`
- `src/types/checkout.ts`
- `src/styles/auth.css`
- `tests/e2e/visual-pages.spec.ts`
- `tests/e2e/catalog.spec.ts`
- `tests/e2e/auth-helpers.ts`
- `ARCHITECTURE.md`

Nenhuma dependência nova foi necessária.
