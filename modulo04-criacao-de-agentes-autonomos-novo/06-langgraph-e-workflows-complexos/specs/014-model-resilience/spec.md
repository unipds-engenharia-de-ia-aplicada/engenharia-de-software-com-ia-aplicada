# Feature Specification: Resiliência de Modelo (Retry + Fallback)

**Feature Branch**: `014-model-resilience`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Resiliência de modelo: .env OPENROUTER_MODEL_FALLBACK; fábrica model.ts: withRetry no primário; withFallbacks([reserva]); Trace: evento \"fallback\"; metrics.modelUsed; Caso nada funcione, 503"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Fábrica Única Blindada (Priority: P1)

O plantão depende de um único ponto de criação de modelo (`createModel` em `src/agents/model.ts`, reexportado pela fábrica do projeto). Hoje uma falha transitória ou queda do modelo primário derruba o turno inteiro. O operador precisa que **retry no primário** e, se configurado, **fallback para um modelo reserva** morem na fábrica — assim roteador, strategies, crítico e sumarizador herdam a mesma blindagem sem lógica duplicada.

**Why this priority**: Sem a fábrica blindada, retry/fallback não cobrem o grafo de produção; é a base da escada de defesas.

**Independent Test**: Invocar a fábrica com fakes de runnable (primário que falha N vezes / reserva que sucede) e assertar ordem retry → fallback sem rede real.

**Acceptance Scenarios**:

1. **Given** `OPENROUTER_MODEL` (primário) e `OPENROUTER_MODEL_FALLBACK` (reserva) definidos, **When** `createModel()` é chamado, **Then** o runnable resultante aplica `withRetry` no primário e `withFallbacks` com a reserva.
2. **Given** só o primário configurado (sem fallback env), **When** `createModel()` roda, **Then** ainda há retry no primário; fallback de modelo é omitido (ou no-op documentado).
3. **Given** qualquer consumidor atual da fábrica (chat / arena / bench / reflector / summarizer), **When** obtém o modelo via `createModel`, **Then** recebe a mesma instância blindada (sem caminho paralelo “nu”).

---

### User Story 2 — Observabilidade: `fallback` no Trace + `modelUsed` (Priority: P1)

Quando o reserva assume (ou o primário vence após retry), o plantonista e os testes precisam ver **qual modelo atendeu** e se houve **fallback**. O `trace` ganha um evento tipado `"fallback"` quando a reserva é usada; `metrics.modelUsed` reporta o id do modelo que de fato respondeu o passo/turno relevante.

**Why this priority**: Sem rastro, a escada de defesas é opaca em demos e depuração.

**Independent Test**: Simular primário sempre-falha + reserva ok → assertar evento `fallback` e `metrics.modelUsed` = id da reserva; primário ok → sem evento `fallback` e `modelUsed` = primário.

**Acceptance Scenarios**:

1. **Given** primário esgota retries com erro e reserva completa com sucesso, **When** o turno `/chat` (ou harness da fábrica) termina `200`, **Then** o `trace` contém ≥ 1 evento `type: "fallback"` e `metrics.modelUsed` identifica o modelo reserva.
2. **Given** primário sucede (com ou sem retries internos), **When** a resposta é montada, **Then** `metrics.modelUsed` identifica o primário e **não** há evento `fallback` indevido.
3. **Given** evento `fallback`, **When** inspecionado, **Then** carrega `node` (se no caminho do grafo) e conteúdo/campos suficientes para saber primário → reserva (ex. ids dos modelos).

---

### User Story 3 — Degradação Controlada com HTTP 503 (Priority: P1)

Se primário e reserva (quando houver) falharem, o sistema **não** inventa resposta: devolve **503** com erro de domínio claro e, quando possível, rastros no `trace` indicando a falha / tentativas. O cliente sabe que o serviço de modelo está indisponível.

**Why this priority**: Fecha a escada de defesas; evita 200 enganoso ou 500 genérico sem contrato.

**Independent Test**: Fábrica/harness com primário e reserva sempre-falha → HTTP `503` (ou erro de domínio traduzido na borda) sem `answer` útil de sucesso.

**Acceptance Scenarios**:

1. **Given** primário e reserva falham após retries, **When** `POST /chat` executa, **Then** status **503** e corpo com erro previsível (ex. `model_unavailable` / mensagem legível).
2. **Given** só primário configurado e ele falha esgotando retry, **When** `/chat` roda, **Then** também **503** (sem inventar fallback).
3. **Given** 503, **When** o cliente lê a resposta, **Then** não recebe `200` com `answer` fabricada; métricas/trace podem incluir evidência da falha quando o turno chegou a emitir eventos.

---

### Edge Cases

- `OPENROUTER_MODEL_FALLBACK` ausente ou igual ao primário: MUST tratar como “sem reserva distinta” (só retry); não loop infinito de fallback para si mesmo.
- `OPENROUTER_MODEL_FALLBACK` inválido / vazio após trim: MUST ignorar (como ausente).
- Falhas não-retryable (ex. 401 auth): MUST falhar rápido sem esgotar retries inúteis — default: retry apenas erros transitórios (timeouts / 5xx / rate-limit), detalhe no plano.
- Fallback dispara no meio de um nó do grafo: MUST ainda assim registrar evento `fallback` e `modelUsed` coerentes no resultado do turno quando o caminho HTTP monta a resposta.
- Arena/bench: herdam a fábrica; mapeamento exato de 503 vs exit code CLI fica no plano (HTTP é o contrato canônico desta feature).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST ler `OPENROUTER_MODEL_FALLBACK` do ambiente (via `--env-file` / `process.env`) como id do modelo reserva.
- **FR-002**: `createModel` em `src/agents/model.ts` MUST aplicar **`withRetry`** ao modelo primário (`OPENROUTER_MODEL` ou default atual).
- **FR-003**: Quando `OPENROUTER_MODEL_FALLBACK` estiver definido e distinto do primário, `createModel` MUST compor **`withFallbacks([reserva])`** sobre o primário com retry (ordem: retry no primário → fallback para reserva).
- **FR-004**: A blindagem MUST viver na fábrica única consumida pelo grafo/strategies (sem duplicar retry/fallback em cada nó).
- **FR-005**: O domínio de trace MUST incluir o tipo de evento `"fallback"`.
- **FR-006**: Quando a reserva atender com sucesso após falha do primário, o `trace` MUST incluir um evento `type: "fallback"`.
- **FR-007**: A resposta de sucesso de `/chat` MUST incluir `metrics.modelUsed` com o identificador do modelo que efetivamente produziu a resposta (primário ou reserva).
- **FR-008**: Se primário (e reserva, se houver) falharem, `POST /chat` MUST responder **503** com erro de domínio traduzido na borda HTTP.
- **FR-009**: `.env.example` MUST documentar `OPENROUTER_MODEL_FALLBACK`.
- **FR-010**: DEVE existir suíte de testes sem rede (runnables/modelos fake) cobrindo: retry no primário; ativação de fallback + evento + `modelUsed`; falha total → 503.

### Key Entities

- **Primary Model**: Modelo configurado por `OPENROUTER_MODEL` (default existente do projeto).
- **Fallback Model**: Modelo configurado por `OPENROUTER_MODEL_FALLBACK`, usado só após esgotar o primário com retry.
- **Fallback TraceEvent**: Evento `type: "fallback"` registrando a troca primário → reserva.
- **ExecutionMetrics** (estendido): Campo `modelUsed` (string) no caminho `/chat`.
- **ModelUnavailableError** (ou equivalente): Erro de domínio que a borda HTTP mapeia para **503**.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Com primário flaky (falha nas primeiras tentativas) e sucesso depois, 100% dos testes de retry concluem sem acionar fallback indevido.
- **SC-002**: Com primário sempre-falha e reserva ok, 100% dos casos de teste emitem evento `fallback` e `metrics.modelUsed` = reserva.
- **SC-003**: Com todos os modelos falhando, 100% das requisições `/chat` de teste retornam **503** (nunca 200 com resposta inventada).
- **SC-004**: Um único `createModel` blindado é o ponto de configuração — zero factories paralelas sem retry/fallback no caminho de produção.

## Assumptions

- A ordem da escada é: **retry (primário) → fallback (reserva) → 503**; alinhada ao material da unidade.
- Contagem/backoff exatos do `withRetry` usam defaults razoáveis do LangChain ou constantes documentadas no plano (ex. 3 tentativas); sem [NEEDS CLARIFICATION].
- `metrics.modelUsed` no `/chat` refere-se ao modelo que produziu a **resposta do turno** (strategy); se o roteador também falhar/trocar modelo, o plano decide se há um único campo ou o do último nó bem-sucedido — default: **modelo da strategy que gerou o `answer`**, com evento `fallback` sempre que a reserva foi usada em qualquer chamada relevante do turno se observável; mínimo obrigatório: campo presente no `200` de sucesso.
- Observabilidade fina por-nó (qual chamada LLM usou qual modelo) pode enriquecer o evento `fallback`; não bloqueia o MVP.
- Fora de escopo: circuit breaker distribuído, fila de retry assíncrona, múltiplos fallbacks em cadeia além de um reserva, UI.
