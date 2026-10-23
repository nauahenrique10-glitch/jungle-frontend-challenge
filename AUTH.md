# Autenticação e sessão simuladas do Kurio

Atualização de estabilidade dos testes: ver [AUTH-STABILITY.md](./AUTH-STABILITY.md), com diagnóstico de upload no Service Worker, isolamento do navegador por teste e resultados das novas validações. O resultado 155/156 descrito adiante é histórico.

## Execução e credenciais de demonstração

`npm ci` e `npm run dev`, com MSW ativo por padrão. `VITE_ENABLE_MSW=false` exige uma API compatível externa; não há fallback de autenticação na interface. README, fontes, assets e referências originais permanecem intactos.

| Usuário fictício | E-mail | Username | Senha de demonstração |
| --- | --- | --- | --- |
| Alice Colecionadora (`user-alice`) | alice@kurio.test | alicekurio | KurioDemo!2026 |
| Bruno Colecionador (`user-bruno`) | bruno@kurio.test | brunokurio | KurioDemo!2026 |

As fixtures são exclusivamente mock, em `src/services/mocks/auth-store.ts`. Elas armazenam perfil e verificadores PBKDF2-SHA-256 (600000 iterações, 256 bits), com salts distintos. A senha acima está documentada para executar a demonstração e os testes; não está embutida nos componentes ou no cliente HTTP. Novos cadastros recebem salt aleatório e o mesmo esquema de derivação. A UI envia a senha somente no corpo da requisição e a mantém transitoriamente no formulário/mutation, nunca em storage.

O simulador persiste em `kurio:mock-auth-db:v1` apenas usuários, perfis mínimos, salts, verificadores e sessões com hash do token. Não persiste senhas em claro. Web Locks serializa as operações do banco mock entre abas, com fila em memória como fallback. O cliente persiste somente o token opaco em `kurio:auth-token`; o QueryClient e seus dados privados não são persistidos. Mutations sensíveis têm gcTime zero e reset após concluir; senhas do formulário são limpas no sucesso. Os demais campos de perfil não confirmados (ENS, apelido de carteira, avatar) são null, sem carteiras ou endereços inventados.

Este é um servidor REST **simulado no navegador**, não uma implementação de segurança de backend real: seu storage pode ser inspecionado/alterado pelo usuário, e o token não é cookie HttpOnly. O verificador protege contra persistência acidental de senha em claro; não transforma o MSW em um servidor confiável. Não há autenticação blockchain, provedor OAuth ou serviço externo.

## Endpoints

| Método e caminho | Contrato |
| --- | --- |
| `POST /api/auth/register` | `{username,email,password,confirmPassword}`; 201 cria usuário e sessão; 409 conflito; 422 campos inválidos. |
| `POST /api/auth/login` | `{email,password}`; 200 cria/rotaciona sessão; 401 credenciais inválidas; 422 validação. |
| `POST /api/auth/logout` | Revoga a sessão do Bearer apresentado; 204 idempotente. |
| `GET /api/auth/session` | Recupera a sessão pelo Bearer; 200 `{session}`; 401 ausente/expirada. |
| `GET /api/account/profile` | Leitura do perfil mínimo associado ao token; 200 `{userId,sessionId,profile}`; 401/403 impede contexto de outro usuário. Não há endpoint de edição. |

Prefixo configurável por `VITE_API_URL`. Login/register retornam `{token,session}`. Sessão: `{id,user,expiresAt}`; `user` contém `id`, `email`, `username`, `displayName`, `ens`, `walletNickname`, `avatarUrl`. IDs de usuário são estáveis; novo cadastro usa UUID técnico e nome de exibição inicial igual ao username normalizado. Sessões têm ID independente e token aleatório de duas UUIDs, armazenado como SHA-256 no banco mock. TTL padrão de 30 minutos, sem prorrogação no refresh.

Erros tipados: `{code,message,fields?}`. E-mail é normalizado para minúsculas; username é único sem distinção de caixa e aceita 3–24 letras/números/_/-. Cadastro exige senha de 8–128 caracteres e confirmação igual. Login exige senha não vazia de até 128 caracteres. O cliente valida para feedback imediato; os handlers revalidam e verificam conflitos atomicamente. Falhas de login não revelam qual credencial estava errada. Autenticação não tem retry automático; o usuário pode reenviar o formulário após erro.

## Sessão e rotas

Query key `['auth','session']`; GET via Axios/MSW no início da aplicação. Antes de entrar em `/perfil` ou `/carteiras`, beforeLoad força revalidação da sessão por HTTP. A guarda de renderização também impede que dados privados apareçam quando a sessão é removida/expira durante a permanência na página. Erro de validação de sessão em área protegida falha de forma fechada, com retry; o catálogo e o detalhe públicos continuam acessíveis.

O destino original é preservado no parâmetro `redirect`. Login/cadastro/abas mantêm o destino; sucesso retoma a rota existente permitida, ou `/perfil`. A validação rejeita origens externas, barras invertidas, controles e loops para as páginas de autenticação. Perfil e carteiras permanecem somente leitura; salvar/avatar/senhas/carteiras continuam desabilitados. Checkout/pedidos/favoritos ainda são prévias ou não existem; quando implementados deverão usar a mesma guarda e política de chave privada, sem criar esses fluxos nesta etapa.

Sessão é revalidada ao focar a janela e no prazo de `expiresAt`, sempre passando por GET /auth/session. O relógio do handler decide a validade. Não há evento falso de sessão bem-sucedida nem dependência de estado de navegação anterior. Logout limpa imediatamente a sessão/token local e todos os dados privados, mesmo se o servidor simulado falhar; nesse caso a UI informa que não foi possível confirmar a revogação remota, sem alegar sucesso remoto. Uma tentativa de login/cadastro também encerra o contexto privado anterior antes de aceitar nova identidade; falha mantém o cliente anônimo.

## Isolamento entre usuários e concorrência

- Chaves privadas: `['private', userId, sessionId, generation, resource]`, preparadas para profile/wallets/favorites/cart/orders. Apenas profile possui consulta nesta etapa.
- Troca de identidade/logout/expiração incrementa a geração, aborta controladores privados, cancela queries `private`, remove suas entradas e remove mutations marcadas como privadas. Dados públicos de catálogo/detalhe são preservados.
- Cada operação privada captura token, usuário, ID de sessão e geração antes do HTTP. O AbortSignal é repassado ao Axios. Ao resolver ou rejeitar, o contexto é conferido novamente: resposta antiga, inclusive um 401 atrasado, não pode preencher cache ou expirar a sessão do novo usuário.
- O token não fica nos defaults globais do Axios. Só endpoints autenticados recebem Authorization; consultas privadas incluem usuário/sessão esperados. O servidor decide o usuário pelo token e rejeita headers incompatíveis com 403. A resposta do perfil é conferida novamente contra os IDs esperados.
- O componente privado é desmontado quando a identidade desaparece e recebe key por sessão. Perfil tem gcTime zero. Não há placeholder de outro usuário ou perfil preenchido a partir das fixtures no componente.
- Eventos de storage por alteração do token em outra aba cancelam o contexto anterior e recuperam a nova sessão pela API. Respostas antigas de GET /auth/session também são descartadas por geração/token.
- Login/register/logout têm trava de operação no serviço; o formulário tem trava síncrona e estado pending compartilhado via TanStack Query. Cliques/Enter repetidos não enfileiram novos POSTs.

Novas consultas/mutations privadas deverão usar `requestForSession`, chaves privadas e, no caso de mutations, `meta.private=true`. Não devem ler fixtures nem escolher usuário por campos enviados pela interface. A geração é um controle de concorrência local, não uma autenticação do servidor.

## Cenários MSW determinísticos

Defina `VITE_AUTH_SCENARIO` ou, no console da aplicação:

```js
localStorage.setItem('kurio:auth-scenario', 'expired')
window.dispatchEvent(new Event('focus'))
```

| Cenário | Efeito |
| --- | --- |
| `success` | Credenciais/validações reais do banco mock; latência 100 ms. |
| `invalid-credentials` | Login sempre retorna 401. |
| `conflict` | Cadastro retorna 409 com erro de e-mail. Conflitos reais também são verificados em success. |
| `validation` | 422 com erro de campo associado. |
| `expired` | Revoga a sessão apresentada no próximo GET autenticado e retorna 401; consome o cenário e volta a success para permitir nova autenticação. |
| `error500` | Endpoints de autenticação/perfil retornam 500. |
| `latency` | Atraso fixo de 1400 ms antes de processar cada requisição de auth/perfil. |
| `short-session` | TTL de 4 segundos para testar expiração natural sem navegação. |

Após trocar cenários com dados em cache, revalide por foco/rota ou recarregue. O cenário de expiração deve ser ativado com sessão existente. Reset de cenário: remova `kurio:auth-scenario`. Reset completo dos usuários de demonstração: encerre a sessão, remova `kurio:auth-token` e `kurio:mock-auth-db:v1`, recarregue; as duas fixtures serão recriadas. Não é preciso limpar os cenários independentes do catálogo/detalhe.

## Verificações e limites

`npm run typecheck`, `npm run build`, `npm run test:e2e -- --workers=1 --timeout=90000`. Testes de autenticação usam contextos isolados, UI e HTTP efetivamente interceptado por MSW, sem page.route para substituir a API. A inspeção do cache no teste de isolamento usa import do QueryClient na página Vite, sem expor uma API de debug na aplicação.

Cobertura: cadastro/sessão e duplicidade, validação/foco/teclado, login inválido/válido, refresh/logout, guards/destino, expiração forçada/natural, troca de usuário com consulta privada pendente/cache anterior, repetição de submit, 500/retry e redirecionamento externo. As capturas existentes agora autenticam pela UI antes de inspecionar perfil/carteiras e continuam verificando que os campos de edição ficam desabilitados.

Fora do escopo: perfil/carteiras editáveis, OAuth Google/Facebook, recuperação de senha, favoritos, carrinho autenticado, checkout, pedidos e Socket.IO. Nenhuma dessas ações aparenta sucesso funcional. Ainda não há backend real/cookies HttpOnly, mudança de senha, renovação de sessão, rate limiting ou recuperação de conta.

Referências técnicas: [guardas do TanStack Router](https://tanstack.com/router/latest/docs/guide/authenticated-routes), [cancelamento e remoção do cache](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient), [Web Crypto/PBKDF2](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits).

## Arquivos desta etapa

Validação executada nesta entrega: TypeScript e build aprovados. A suíte completa executou 156 casos em 390, 414, 768 e 1440 px: 155 passaram; um cadastro em 414 px falhou com `net::ERR_FAILED`, sem resposta HTTP no trace. O mesmo caso passou em cinco repetições isoladas consecutivas, sem alteração de código. A causa da intermitência de rede não foi confirmada; o resultado inicial não foi descartado. Relatório completo em `playwright-report/index.html` e repetição em `playwright-report/auth-repeat/index.html`. Todos os testes existentes de catálogo/detalhe e as verificações de overflow/composição responsiva passaram. Capturas de Login, Cadastro, Perfil, Carteiras e Home foram inspecionadas em desktop/mobile, sem regressões visuais evidentes. README original conferido sem alterações.

- `src/types/auth.ts`
- `src/services/auth.ts`
- `src/services/mocks/auth-store.ts`, `auth-handlers.ts`, `handlers.ts`
- `src/features/account/auth-validation.ts`, `session.tsx`, `auth-preview.tsx`, `account-preview.tsx`
- `src/app/router.tsx`
- `src/components/layout.tsx`, `visual-preview.tsx`
- `src/styles/auth.css`, `globals.css`
- `tests/e2e/auth.spec.ts`, `auth-helpers.ts`, `foundation.spec.ts`, `visual-pages.spec.ts`
- `.env.example`, `AUTH.md`, `ARCHITECTURE.md`
