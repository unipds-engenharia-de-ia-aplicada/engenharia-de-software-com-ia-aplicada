# Research: OpsPilot Reasoning Nucleus

**Phase 0 output for** `specs/001-reasoning-nucleus/plan.md`

All NEEDS CLARIFICATION items from Technical Context are resolved here.

---

## Decision 1 — Trace collection from ReAct strategy

**Decision**: Reconstruct `TraceEvent[]` from the `messages` array returned by `createReactAgent().invoke()` after execution completes — no custom LangSmith callbacks or streaming required.

**Rationale**: `createReactAgent` from `@langchain/langgraph/prebuilt` returns a compiled `CompiledStateGraph` whose `.invoke()` resolves to `{ messages: BaseMessage[] }`. The message array encodes the full execution trace in order:
- `HumanMessage` → the original user input (skip)
- `AIMessage` with `tool_calls` → maps to a `thought` event (content) + one `action` event per tool call (name + args)
- `ToolMessage` → maps to an `observation` event (content, matched via `tool_call_id`)
- `AIMessage` with no `tool_calls` → maps to the final `answer` event

This covers the exact event sequence required by FR-002: `thought → action → observation → ... → answer`.

**Alternatives considered**:
- LangSmith tracing — requires external network call; violates "unit tests must not depend on network" (SC-004)
- `streamMode: "values"` streaming — more complex; not needed since `.invoke()` already returns the complete message array
- Custom `CallbackManager` at each node — verbose and fragile across LangGraph versions

---

## Decision 2 — Plan-and-Execute graph design

**Decision**: Implement as a `StateGraph` with an `Annotation.Root` state containing: `input` (string), `plan` (string[]), `pastSteps` (array of `[step, result]` pairs), `response` (string), and `trace` (TraceEvent[]). Three nodes:
1. **planner** — calls the LLM with the user input and asks it to produce a numbered list of steps; parses response into `plan: string[]`; emits a `plan` TraceEvent
2. **executor** — takes the first step from `plan`, calls `createReactAgent` with that step, records `action`/`observation` events from the sub-graph, appends the result to `pastSteps`
3. **replanner** — calls the LLM with original input + past steps + remaining plan; either returns a revised plan or an `answer`; emits `critique` TraceEvent if plan is revised, `answer` TraceEvent if done

**Rationale**:
- Matches FR-011 exactly (planner / executor / replanner nodes)
- Keeps planner and replanner as simple LLM chain calls (no sub-graph needed); only the executor needs access to tools
- `Annotation` array channels with concat reducer allow trace events to accumulate without replacement
- Maximum 8 steps enforced at the replanner node by truncating the plan before writing it back (FR-012)

**Alternatives considered**:
- Single-graph all-in-one — makes the planner/executor/replanner boundary unclear; harder to test each node in isolation
- Nesting a full `createReactAgent` inside the executor — valid, but executor can be a simpler direct tool-call loop since Plan-and-Execute already controls iteration at the outer level

---

## Decision 3 — Iteration limit enforcement

**Decision**: Pass `{ recursionLimit: maxIterations * 3 }` in the LangGraph invoke config for the ReAct strategy (each "iteration" can consume up to 3 graph steps: agent + tools + agent). For Plan-and-Execute, enforce the 8-step cap at the replanner node in application code, independent of `recursionLimit`.

**Rationale**: LangGraph v0.2.74 exposes `recursionLimit` in `RunnableConfig` (passed as second arg to `.invoke()` / `.stream()`). It counts internal graph steps, not logical iterations. For ReAct, one logical iteration = agent step + tool step + agent step ≈ 3 graph steps. For Plan-and-Execute the iteration limit is owned by the replanner node.

When `recursionLimit` is exceeded, LangGraph throws a `GraphRecursionError`. The strategy wrapper catches this, sets `interrupted: true` in the result, and adds a terminal `TraceEvent` of type `answer` with an "iteration limit reached" message (SC-005, FR-013).

**Alternatives considered**:
- Manual iteration counter in strategy state — duplicates LangGraph's built-in mechanism for ReAct
- `interruptAfter` node hooks — fires mid-execution; harder to produce a clean trace termination

---

## Decision 4 — LLM model factory

**Decision**: `createModel()` in `src/llm/factory.ts` returns a `ChatOpenAI` instance configured with:
```
baseURL: "https://openrouter.ai/api/v1"
apiKey: process.env.OPENROUTER_API_KEY   (throws if missing)
model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini"
temperature: 0
```

**Rationale**: `ChatOpenAI` accepts a `configuration.baseURL` override that points to any OpenAI-compatible endpoint; OpenRouter exposes exactly this interface. Reading from `process.env` with no fallback for the key satisfies FR-004 ("no hardcoded values") and constitution principle 6 ("security by default"). Startup fails fast with a descriptive error if the key is absent, satisfying the edge case in spec ("What if OPENROUTER_API_KEY is not configured?").

**Alternatives considered**:
- `ChatGroq` or `ChatAnthropic` adapters — require separate packages and env vars; OpenRouter is already the chosen gateway
- `dotenv` — not allowed per constitution (use `--env-file` native Node flag instead)

---

## Decision 5 — Tool definition pattern

**Decision**: Each tool is a `DynamicStructuredTool` from `@langchain/core/tools` with a `zod` object schema. Validation happens inside the `func` at construction time (zod parses the input before the handler body runs). Tools are pure functions over the store interface; the store is injected at the call site (arena/strategy constructor).

**Rationale**: `DynamicStructuredTool` is the standard LangChain pattern for typed tool definitions that LangGraph's `ToolNode` and `createReactAgent` understand natively. Zod schemas declared on the tool are also forwarded to the LLM as JSON Schema in the function-calling payload (FR-015).

**Alternatives considered**:
- `tool()` helper (newer shorthand) — available in `@langchain/core` but less explicit; `DynamicStructuredTool` constructor pattern is clearer for readability and testability
- Manual schema validation outside the tool — duplicates what `DynamicStructuredTool` already provides

---

## Decision 6 — In-memory store interface

**Decision**: `InMemoryStore` is a plain class (no Sequelize, no MySQL) implementing a simple interface:
- `getAlerts(status?: "firing" | "resolved"): Alert[]`
- `createIncident(data: { title, service, severity }): Incident`
- `resolveIncident(id: string): Incident` (throws `IncidentNotFoundError` if id not found)

Seeded with a dedicated `seedStore(store)` function called at arena/index startup.

**Rationale**: Spec explicitly states "store in-memory does not persist between process restarts; real MySQL is future infrastructure." A plain class is the simplest implementation that satisfies all current requirements. The interface is kept narrow so a future Sequelize adapter can drop in without touching the tools or strategies.

**Alternatives considered**:
- Map-based functional store — valid, but a class with typed methods is easier to mock in tests
- Sequelize `InMemory` dialect — adds unnecessary complexity; SQLite in-memory would be cleaner but still out of scope here
