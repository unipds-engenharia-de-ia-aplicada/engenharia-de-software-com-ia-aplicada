# Tasks: Sumarização de Histórico (Pruning)

**Input**: Design documents from `/specs/011-history-summarization/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — FR-010 / SC-001–SC-005; fake summarizer; `:memory:`

**Note**: Generated during `/speckit.implement` (tasks.md was missing). LLM prompt = user-provided `SUMMARIZER_PROMPT`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 Scaffold `src/chat/history-summarizer.ts` with exports stubs: `HISTORY_LIMIT`/`SUMMARY_BATCH_SIZE`/`SUMMARY_TOKEN_TARGET`, `ConversationSummarizer`, `SUMMARIZER_PROMPT`, `maybeSummarize`, `createLLMConversationSummarizer`, `formatSummaryForPrompt`
- [x] T002 [P] Scaffold `src/chat/history-summarizer.test.ts`

---

## Phase 2: Foundational

- [x] T003 Extend `TraceEventType` with `"summarize"`; extend `ConversationStore` + `ConversationSummaryRecord`; add `summary` to `ContextBreakdown` in `src/domain/types.ts`
- [x] T004 Update `buildContextBreakdown` in `src/context/tokens.ts` (+ tests) for `summary` key
- [x] T005 Run `npm run typecheck` (may fail until store methods exist — complete T006–T007 next)

---

## Phase 3: US1/US3 — Store + persistence

- [x] T006 Implement `conversation_summaries` DDL + `countMessages` / `messagesAscending` / `getSummary` / `upsertSummary` in `src/store/sqlite-conversation-store.ts`
- [x] T007 [P] Tests for summary APIs + ascending batch in `src/store/sqlite-conversation-store.test.ts`

---

## Phase 4: US2/US4 — Summarizer + runChat

- [x] T008 [P] Tests for `maybeSummarize` (0/1 calls, merge, fail-safe) in `src/chat/history-summarizer.test.ts`
- [x] T009 Implement `maybeSummarize`, `formatSummaryForPrompt`, fake helpers, `createLLMConversationSummarizer` with user `SUMMARIZER_PROMPT` in `src/chat/history-summarizer.ts`
- [x] T010 Set `HISTORY_LIMIT=8`; wire summarizer + summary inject + summarize trace + breakdown.summary in `src/chat/run-chat.ts`
- [x] T011 Wire `summarizer` through `ChatAppDeps` / `createApp` in `src/http/server.ts` and `src/index.ts`
- [x] T012 Update compose/HTTP tests for limit 8, summarize event, summary injection; fix regressions assuming 12

---

## Phase 5: Polish

- [x] T013 Run full `npm test` + `npm run typecheck`; tick quickstart SC checklist

---

## Notes

- MVP = store + maybeSummarize fake + runChat window 8
- Production LLM uses exact `SUMMARIZER_PROMPT` from implement args
