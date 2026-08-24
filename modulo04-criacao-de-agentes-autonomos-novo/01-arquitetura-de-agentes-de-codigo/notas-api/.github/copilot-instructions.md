# Copilot Instructions

## Stack
- Node.js 22 LTS.
- TypeScript ESM com `strict: true`.
- `zod` na fronteira (HTTP/CLI) para validar entrada e saída.
- Testes com `node:test` via `tsx`.
- Sem framework HTTP: `node:http` por design.

## Comandos
- `dev`: `tsx src/index.ts` — API em `http://localhost:3000`.
- `cli`: `tsx src/cli.ts`.
- `test`: `node --import tsx --test "src/**/*.test.ts"`.
- `typecheck`: `tsc --noEmit`.

## Estrutura
- `src/domain`: tipos + schemas zod; sem IO.
- `src/store`: persistência in-memory atrás de interface.
- `src/service`: regras de negócio.
- `src/http`: adaptação HTTP.
- `src/cli.ts`: entrada de CLI.
- `specs/`: artefatos spec-driven.

## Convenções
- Camadas não pulam: `http/cli -> service -> store`.
- Toda entrada externa é validada com zod.
- Erros de domínio são classes traduzidas na borda.
- Lógica nova nasce com teste.
- `npm run typecheck` e `npm test` sempre verdes.
- Nunca commitar secrets e nunca ler `.env`.

## Fluxo de trabalho
- `/especificar -> /planejar -> /tarefas -> /implementar`.
- Revisão humana entre as fases.
- Artefatos em `specs/`.
