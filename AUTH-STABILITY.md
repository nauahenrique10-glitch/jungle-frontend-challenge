# Estabilidade dos testes de autenticação

## Causa observada e limite da conclusão

Ambiente investigado: Windows, Node 24.20.0, Playwright 1.64.1 / Chromium 156.0.8078.4, Axios 1.20.0 e MSW 2.15.0.

A falha foi reproduzida em login e cadastro, antes de o POST chegar ao handler do MSW. Instrumentação temporária no Service Worker identificou **`Request.arrayBuffer()` rejeitando a leitura do upload com `TypeError: Failed to fetch`**. O navegador reportou `net::ERR_FAILED`, `canceled: false`; os cancelamentos intencionais dos GETs foram reportados separadamente como `net::ERR_ABORTED`, `canceled: true`.

Recorte dos eventos capturados no teste de login em contexto novo 9:

```text
SW request body failed POST http://127.0.0.1:4173/api/auth/login TypeError: Failed to fetch
Network.loadingFailed: /api/auth/login, net::ERR_FAILED, canceled=false
SW rejection: TypeError: Failed to fetch
ServiceWorker.workerErrorReported: Uncaught (in promise) TypeError: Failed to fetch
sourceURL: http://127.0.0.1:4173/mockServiceWorker.js
```

Não houve `request:start`/handler de login nessa falha. Havia um único registro de SW ativado. Não era HTTP 401/409/500 nem um aborto da mutation pelo QueryClient. O arquivo público do SW e o distribuído pela dependência tinham SHA-256 idêntico (`26171599D94D5445297303F3A1F1CEDEC26835EA3D0057DCFA92EC520CB35CCA`).

A condição discriminante foi **reutilizar o mesmo processo de navegador para sucessivos contextos**. Contextos tinham cookies, storage e registros independentes, mas a leitura nativa do upload ainda falhava nessa condição. `--repeat-each` de um único caso iniciava novos workers/navegadores e não reproduzia essa condição.

Isso localiza a causa observável no transporte de upload do navegador/Service Worker sob reutilização de processo neste ambiente. Não foi identificado um issue upstream ou a causa interna do Chromium; não se afirma que o código do navegador foi corrigido. A solução da suíte é isolar esse processo e manter a detecção de falhas de transporte. Não foi feito retry silencioso de cadastro/login.

## Experimentos de controle

- Cadastro original em 414 px: 20/20 repetições seriais passaram antes da correção, portanto esse resultado sozinho não foi aceito como evidência de resolução.
- Autenticação com navegador compartilhado: 87/88 passaram; falha de POST no login foi reproduzida.
- Instrumentação de canal MSW: confirmou falha anterior ao handler e leitura nativa do corpo rejeitada. Timeouts de inicialização da instrumentação foram separados das falhas de upload.
- 100 POSTs consecutivos em um contexto, mais duas rodadas de 100: passaram.
- 100 contextos com navegador novo e HTTP direto: passaram.
- 100 contextos com navegador novo e serviço `authenticate`: passaram.
- 100 logins de interface com reinício de navegador por repetição: passaram.
- Vários casos por worker, navegador compartilhado: falha em login após 14 aprovações (três casos interrompidos pelo limite de falhas). Esse experimento capturou a rejeição em `Request.arrayBuffer()`.
- Adaptador Fetch do Axios: falhou no mesmo ponto após 15 aprovações. A alteração foi revertida; a aplicação mantém o transporte original.
- Mesmo conjunto de casos com processo de navegador por teste: **96/96 passaram, quatro workers**, sem patches nos métodos nativos do SW.

Em um experimento de diagnóstico, duas execuções simultâneas reutilizaram o mesmo servidor Vite; uma encerrou o servidor enquanto a outra ainda rodava, gerando `ERR_CONNECTION_REFUSED`. Esse erro distinto motivou a remoção de `reuseExistingServer`, mas não é apresentado como causa do `ERR_FAILED` original.

## Correção e garantias

- `tests/e2e/test-fixture.ts` cria e encerra um navegador/contexto por teste. Cookie jar, localStorage, IndexedDB, CacheStorage, módulos, QueryClient e SW não são compartilhados entre testes. Refresh/navegação **dentro** do teste preservam a sessão e continuam sendo testados.
- Todos os specs E2E usam essa fixture. O isolamento do processo elimina a condição reproduzida; não passa por apagar storage após cada reload nem por inventar respostas.
- Logs passivos CDP distinguem aborto, falha de transporte, CORS/bloqueio e erro do SW. São anexados apenas nas falhas, sem corpos/headers de autenticação. Os patches temporários de `Request.arrayBuffer`/`fetch` e os imports instrumentais do MSW foram removidos.
- O bootstrap continua aguardando `worker.start()` antes de renderizar providers. `startMocking()` compartilha a mesma promise em chamadas repetidas; requisições inesperadas ao prefixo da API geram erro do MSW, enquanto assets podem seguir para o Vite.
- Playwright possui servidor exclusivo, porta fixa com `--strictPort`, cenários MSW iniciais `success`, retries zero e dois workers por padrão. Não foram adicionados aumentos de timeout nem `waitForTimeout`. O timer preexistente no teste de respostas fora de ordem do catálogo foi preservado, sem relação com o fluxo de autenticação investigado.
- Os novos testes verificam o script do SW servido como JavaScript, um único registro ativado/controlando primeira carga/reload/navegação direta e respostas efetivamente vindas do SW.
- Uma barreira de teste MSW, limitada a **uma** consulta antiga, comprova que cancelar GET `/auth/session` não cancela POST `/auth/register`, e que a resposta antiga não remove a nova sessão. O helper está em `tests/e2e`, não é importado pela aplicação e não acessa fixtures diretamente.

## Validação final

Validação concluída em 22/10/2026, sem retries automáticos e sem aumento dos timeouts:

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado |
| `npm run build` | Aprovado |
| Suíte completa, dois workers, 390/414/768/1440 px | **180/180**, 10,7 minutos |
| Cadastro em 414 px, um worker, 20 repetições consecutivas | **20/20**, 3 minutos |
| Autenticação completa nas quatro larguras, dois workers, duas repetições | **88/88**, 7 minutos |
| Comparação de isolamento de processo, quatro workers | **96/96** |

Comandos das rodadas finais:

```powershell
npm run typecheck
npm run build
npm run test:e2e -- --workers=2
$env:PLAYWRIGHT_HTML_OUTPUT_DIR = '.artifacts/cadastro-414-report'
npm run test:e2e -- tests/e2e/auth.spec.ts --project=chromium-414 --workers=1 --grep 'cadastro cria' --repeat-each=20 --output=.artifacts/cadastro-414
$env:PLAYWRIGHT_HTML_OUTPUT_DIR = '.artifacts/auth-repeat-report'
npm run test:e2e -- tests/e2e/auth.spec.ts --workers=2 --repeat-each=2 --output=.artifacts/auth-repeat
Remove-Item Env:PLAYWRIGHT_HTML_OUTPUT_DIR
```

Relatórios: `playwright-report/index.html` (180 casos), `.artifacts/cadastro-414-report/index.html` (20 casos) e `.artifacts/auth-repeat-report/index.html` (88 casos). Os resultados `.last-run.json` dessas três execuções têm `status: passed` e nenhum teste reprovado. O experimento de 96 casos foi executado antes de reduzir o arquivo de diagnóstico temporário aos seis cenários permanentes de transporte. Os relatórios temporários da investigação foram sobrescritos pela suíte final; o recorte técnico dos eventos foi transcrito acima durante a investigação.

Os testes existentes de catálogo, detalhe, imagens, navegação, overflow e composição responsiva passaram. Nenhuma diferença visual foi introduzida: não foram editados estilos, componentes de apresentação, fontes ou assets. README original conferido sem diferença e com SHA-256 `208FF2613E6E3AC4330A40CEFC8610DFC469866167842C480BCB9B6FC5E08B8A`.

## Risco conhecido

Reativar a fixture padrão com navegador compartilhado pode reintroduzir o erro nativo de upload nesta combinação de versões. O isolamento custa mais inicializações de navegador. Atualizações futuras de Chromium/Playwright devem ser validadas antes de remover essa medida; testes verdes isolados não provam que o problema upstream desapareceu.

README, identidade visual, dados, contratos REST, catálogo, detalhe e funcionalidades de autenticação foram preservados. Nenhum backend, retry de negócio ou nova funcionalidade foi adicionado.

## Arquivos desta etapa

- `src/main.tsx`, `src/services/mocks/browser.ts`: bootstrap único e erro para API não tratada.
- `playwright.config.ts`: servidor exclusivo, cenários iniciais conhecidos, retries zero, concorrência padrão controlada.
- `tests/e2e/test-fixture.ts`: navegador/contexto por teste e diagnóstico passivo.
- `tests/e2e/auth-transport.spec.ts`: prontidão do SW, cancelamento concorrente e regressão de upload.
- `tests/e2e/msw-session-barrier.ts`: barreira de uma consulta, somente para teste.
- `tests/e2e/auth.spec.ts`, `catalog.spec.ts`, `nft-detail.spec.ts`, `foundation.spec.ts`, `visual-pages.spec.ts`: import da fixture isolada; demais cenários/assertions existentes preservados.
- `.gitignore`: ignora artefatos adicionais.
- `AUTH.md`, `AUTH-STABILITY.md`: diagnóstico e validação.
