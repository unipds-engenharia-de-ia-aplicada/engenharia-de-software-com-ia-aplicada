# Unidade 4 — Memória e Reflexão em Agentes Autônomos

O OpsPilot ganha **memória**: histórico persistente de conversa, memória semântica com embeddings locais e um refletor que destila aprendizados duráveis após cada resposta. Snapshot do commit `b63341d` ("memorias e script") — estado exato do fim da unidade.

## O que é novo nesta unidade

- **Spec `007-persistent-conversation`** — `src/store/sqlite-conversation-store.ts` (tabela `messages` no mesmo SQLite) + `src/chat/run-chat.ts` e `src/chat/compose-prompt.ts`: o `POST /chat` ganha `conversationId` e janela de mensagens recentes no prompt. *(O código chegou no snapshot da U3 por ter sido commitado junto; a matéria é desta unidade.)*
- **Spec `008-semantic-memory`** — `src/memory/embeddings.ts` + `src/memory/memory-store.ts`: memória por `userId` com embeddings locais (`all-MiniLM-L6-v2` via `@huggingface/transformers`), `remember` com dedup por similaridade, `recall` top-k por produto escalar com threshold, `forget`; endpoint `POST /memories` e `userId` no `/chat`; `src/memory/chat-user-context.ts` injeta memórias no prompt.
- **Spec `009-learning-reflector`** — `src/memory/learning-reflector.ts`: Reflection reusada como **loop de aprendizado** — pós-resposta, assíncrono, com saída estruturada (`{hasLearning, fact}`); evento `learning` no trace; `src/agents/system-prompt.ts`.
- `scripts/conversa-longa.sh` — script de 30 turnos que "planta" uma decisão no histórico (usado como gancho para a U5).

## Diferenças em relação ao roteiro

- `GET /memories` e `DELETE /memories` ficaram fora do escopo (corte já previsto no próprio plano).
- O `scripts/conversa-longa.sh` estava roteirizado para a U5, mas entrou no commit desta unidade.
- O refletor recebeu correções posteriores (commit "war room", durante a gravação das unidades finais) — presentes a partir da pasta 06.

## Como rodar

```bash
npm ci && cp .env.example .env
npm run dev
# na primeira execução, o modelo de embeddings é baixado localmente
npm test && npm run typecheck
```
