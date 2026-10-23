# Lighthouse Audit

Auditoria executada em build de producao local usando Vite Preview.

## Ambiente

- Node.js: v24.20.0
- npm: 11.19.0
- Lighthouse: 13.5.0
- Paginas: Home e detalhe do NFT Emerald Ape #042
- Perfis: Mobile e Desktop
- Medicoes: 3 execucoes por pagina/perfil
- Total: 12 auditorias

## Metodologia

Para cada combinacao de pagina e dispositivo foram realizadas tres medicoes independentes. O resultado reportado abaixo e a mediana das tres execucoes.

## Medianas

| Pagina | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Home | Mobile | 50 | 95 | 96 | 92 | 4660 ms | 0.049 | 1034 ms |
| Home | Desktop | 88 | 100 | 96 | 92 | 1812 ms | 0.002 | 73 ms |
| Detalhe | Mobile | 58 | 100 | 96 | 92 | 4242 ms | 0 | 1169 ms |
| Detalhe | Desktop | 95 | 100 | 96 | 92 | 1246 ms | 0.000 | 87 ms |

## Metas do desafio

- Performance: >= 90
- Accessibility: >= 95
- Best Practices: >= 95
- SEO: >= 90

## Observacoes

Os relatorios HTML e JSON das 12 execucoes estao versionados junto ao projeto.

A aplicacao prioriza a fidelidade dos fluxos obrigatorios, incluindo MSW, Socket.IO, TanStack Query, persistencia de sessao, checkout simulado e testes E2E. O custo de inicializacao da camada de mocks e do JavaScript inicial impacta principalmente a pontuacao de Performance em ambiente mobile.

Accessibility, Best Practices e SEO sao acompanhados juntamente com Performance, LCP, CLS e TBT.

## Como reproduzir

```bash
npm install
npm run build
npm run preview
```

Em outro terminal:

```bash
npm run lighthouse -- http://127.0.0.1:4173/
```
