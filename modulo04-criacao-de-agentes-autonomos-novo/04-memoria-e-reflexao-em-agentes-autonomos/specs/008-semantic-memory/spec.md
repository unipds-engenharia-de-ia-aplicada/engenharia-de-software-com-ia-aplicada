# Feature Specification: Memória Semântica

**Feature Branch**: `008-semantic-memory`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Memória semântica: MemoryStore por userId - rember (dedup > 0.92), recall top-3 por produto escalar (min 0.3), forget; tabela memories, embedding all-MiniLM-L6-v2 local em BLOB; /chat ganha userId e injeta o recall no prompt; teste: recall acha fato sem palavra em comum. user: @huggingface/transformers com pooling: mean + normaliza: true e lazy singleton src/memory/embeddings.ts e src/memory/memory-store.ts. As colunas de memories (id, user_id, fact, embedding, created_at"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Plantonista Guarda Fatos por Usuário (Priority: P1)

Um plantonista (ou o fluxo de chat associado a um `userId`) registra fatos relevantes na memória semântica. O sistema armazena o fato sob aquele usuário e evita duplicatas quase idênticas: se um fato novo for semanticamente muito parecido com um já guardado (similaridade acima do limiar de deduplicação), o novo não é inserido como cópia redundante.

**Why this priority**: Sem `remember` confiável e isolado por usuário, recall e injeção no prompt não têm conteúdo útil; dedup evita inflar a memória com reformulações do mesmo fato.

**Independent Test**: Com store em `:memory:` e embeddings locais (ou harness determinístico do plano), chamar `remember` duas vezes com fatos quase equivalentes e assertar que só uma entrada permanece (ou que a segunda é rejeitada/mesclada conforme contrato do plano); fatos de outro `userId` não interferem.

**Acceptance Scenarios**:

1. **Given** um `userId` sem memórias, **When** o sistema executa `remember` com um fato textual, **Then** o fato fica persistido para aquele usuário e disponível para recall futuro.
2. **Given** um fato já armazenado para o `userId`, **When** se tenta `remember` de um fato com similaridade > 0,92 ao existente, **Then** o sistema NÃO cria uma segunda entrada redundante (deduplicação).
3. **Given** dois `userId` distintos, **When** cada um grava fatos, **Then** as memórias permanecem isoladas (recall de A não retorna fatos de B).

---

### User Story 2 — Recall Semântico Top-3 no Prompt do Chat (Priority: P1)

Antes de executar a estratégia em `POST /chat`, o sistema identifica o `userId` do request, faz `recall` da consulta (mensagem ou texto derivado) e injeta no prompt até 3 fatos mais relevantes, desde que a similaridade (produto escalar com vetores normalizados) seja ≥ 0,3. O plantonista não precisa repetir fatos já memorizados com as mesmas palavras.

**Why this priority**: O valor de negócio é o agente usar contexto semântico entre sessões/turnos além do histórico recente de mensagens.

**Independent Test**: Popular memórias com um fato; consultar com frase **sem palavras em comum** com o fato; assertar que o recall devolve o fato entre o top-3 (score ≥ 0,3) e que a composição do `/chat` inclui esses fatos no prompt.

**Acceptance Scenarios**:

1. **Given** memórias persistidas para um `userId` e uma consulta semanticamente relacionada, **When** `recall` é executado, **Then** retorna no máximo 3 fatos, ordenados por similaridade decrescente, todos com score ≥ 0,3.
2. **Given** um fato memorizado e uma pergunta **sem sobreposição lexical** com o texto do fato, **When** o teste de recall roda, **Then** o fato é encontrado (prova de busca semântica, não keyword).
3. **Given** `POST /chat` com `userId` válido e memórias relevantes, **When** o turno é processado, **Then** o prompt composto inclui o resultado do recall antes da execução da estratégia.
4. **Given** `userId` sem memórias ou sem scores ≥ 0,3, **When** `/chat` roda, **Then** o turno segue normalmente sem bloco de memória (ou com lista vazia), sem falhar.

---

### User Story 3 — Esquecer Fatos e Validar Store Offline (Priority: P2)

O operador (ou API/fluxo definido no plano) pode `forget` uma memória específica de um usuário. Desenvolvedores validam `MemoryStore` (`remember` / `recall` / `forget`) e a integração de `/chat` com `userId` em testes determinísticos, preferencialmente com DB `:memory:` e sem rede quando o harness permitir.

**Why this priority**: Correção e privacidade exigem remoção; regressão segura exige testes alinhados às features `003`–`007`.

**Independent Test**: `remember` → `forget` → `recall` não retorna o fato; suíte do store em `:memory:`; teste de `/chat` com `userId` e injeção de recall (estratégia fake).

**Acceptance Scenarios**:

1. **Given** um fato memorizado com identificador conhecido, **When** `forget` é chamado para aquele id e `userId`, **Then** o fato deixa de aparecer em recalls subsequentes.
2. **Given** `forget` com id inexistente ou de outro usuário, **When** a operação roda, **Then** o comportamento é seguro e testável (no-op ou erro de domínio claro — plano fixa; não apaga memórias de outro usuário).
3. **Given** a suíte de testes da feature, **When** `npm test` roda, **Then** o caso “recall acha fato sem palavra em comum” passa.

---

### Edge Cases

- O que acontece quando `userId` está ausente em `/chat`? MUST falhar na validação do body (`400`) se `userId` for obrigatório nesta feature; default da spec: **`userId` obrigatório** no body de `/chat` (assumido; ver Assumptions).
- O que acontece quando o texto do fato ou da consulta está vazio / só whitespace? MUST rejeitar na validação (store ou borda HTTP) sem gravar embedding vazio.
- O que acontece quando há mais de 3 memórias acima de 0,3? MUST retornar apenas as 3 de maior score.
- O que acontece quando similaridade está exatamente em 0,92 (dedup) ou 0,3 (recall)? MUST tratar limiares como **estritos conforme contrato**: dedup se similaridade **> 0,92**; recall inclui se score **≥ 0,3** (mínimo inclusivo no recall).
- O que acontece na primeira carga do modelo de embedding (cold start)? MUST inicializar de forma lazy (singleton); falha de carga MUST virar erro de domínio observável, sem corromper o store.
- O que acontece se `remember` e histórico de conversa (`007`) coexistem? MUST ambas as injeções poderem estar no prompt; ordem/formato fixados no plano; escopos independentes (`userId` vs `conversationId`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST oferecer um `MemoryStore` com operações `remember`, `recall` e `forget`, sempre escopadas por `userId`.
- **FR-002**: `remember(userId, fact)` MUST gerar um embedding do fato, persistir o registro e aplicar deduplicação: se existir memória do mesmo usuário com similaridade **> 0,92**, MUST NÃO inserir duplicata redundante.
- **FR-003**: `recall(userId, query)` MUST retornar até **3** fatos do usuário ordenados por similaridade (produto escalar) decrescente, incluindo apenas itens com score **≥ 0,3**.
- **FR-004**: `forget(userId, id)` MUST remover a memória indicada pertencente àquele usuário (ou no-op/erro de domínio se inexistente — plano documenta; nunca remove de outro usuário).
- **FR-005**: A persistência MUST usar tabela `memories` com colunas: `id`, `user_id`, `fact`, `embedding` (BLOB), `created_at`, no padrão SQLite do projeto (`node:sqlite` / `DatabaseSync`, DDL idempotente, prepared statements).
- **FR-006**: Embeddings MUST ser produzidos localmente com o modelo **all-MiniLM-L6-v2** (via stack `@huggingface/transformers`), com pooling **mean** e **normalize: true**, e o vetor serializado no BLOB; carregamento MUST ser **lazy singleton**.
- **FR-007**: A implementação de embedding e store MUST viver em `src/memory/embeddings.ts` e `src/memory/memory-store.ts` (ou caminhos equivalentes sob `src/memory/` se o plano renomear levemente — nomes canônicos do input do usuário).
- **FR-008**: `POST /chat` MUST aceitar `userId` (validado com zod) e, antes da estratégia, MUST executar `recall` e injetar os fatos recuperados no prompt composto.
- **FR-009**: DEVE existir teste automatizado demonstrando que `recall` recupera um fato **sem palavras em comum** entre query e fato (similaridade semântica).
- **FR-010**: Testes do `MemoryStore` MUST poder rodar com DB `:memory:`; a suíte MUST permanecer alinhada a `npm test` / `npm run typecheck` verdes.
- **FR-011**: Memórias de usuários distintos MUST ser isoladas em todas as operações.

### Key Entities

- **Memory (fato)**: Unidade de memória semântica. Atributos: `id`, `userId`, texto do `fact`, vetor `embedding`, `createdAt`.
- **MemoryStore**: Contrato de persistência/consulta semântica (`remember`, `recall`, `forget`) por usuário.
- **EmbeddingPipeline**: Serviço lazy singleton que transforma texto em vetor normalizado (all-MiniLM-L6-v2, mean pooling).
- **ChatRequest** (estendido): Campos existentes (`message`, `strategy?`, `reflect?`, `conversationId?`) mais `userId`.
- **RecalledFacts**: Lista de até 3 fatos (texto + score opcional na camada interna) injetados no prompt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos testes cobertos, `recall` devolve no máximo 3 fatos e nenhum com score abaixo de 0,3.
- **SC-002**: Deduplicação impede segunda inserção quando similaridade > 0,92; assertado em teste do store.
- **SC-003**: O teste “fato sem palavra em comum” passa de forma determinística na suíte CI local (`npm test`).
- **SC-004**: Request `/chat` com `userId` e memórias relevantes inclui os fatos recallados no prompt (visível em harness fake / asserção de composição).
- **SC-005**: `forget` remove o fato do universo de recall daquele usuário; isolamento entre `userId` é verificado em teste.
- **SC-006**: Após a feature, `npm test` e `npm run typecheck` permanecem verdes.

## Assumptions

- “rember” no input do usuário significa **`remember`**.
- Similaridade é **produto escalar** sobre embeddings **L2-normalizados** (equivalente a cosseno); limiares 0,92 (dedup, estrito `>`) e 0,3 (recall, inclusivo `≥`) são fixos nesta feature.
- `userId` em `/chat` é **obrigatório** nesta feature (string não vazia validada com zod); autenticação real / SSO permanece fora de escopo (cliente envia o id).
- Coexistência com `007-persistent-conversation`: histórico de mensagens e memória semântica são mecanismos distintos; ambos podem alimentar o prompt.
- Persistência reutiliza o mecanismo de caminho DB do projeto (`OPSPILOT_DB` / mesmo arquivo ou conexão compartilhável); co-localização com `SqliteOpsStore` / conversation store fica no plano.
- Módulos canônicos: `src/memory/embeddings.ts` e `src/memory/memory-store.ts`; detalhes de API TypeScript e serialização do BLOB (Float32Array → Buffer, etc.) no plano.
- Carregamento do modelo Hugging Face pode baixar pesos na primeira execução em ambiente de desenvolvimento; testes MUST documentar no plano se usam modelo real, cache local, ou double — o aceite do teste semântico (SC-003 / FR-009) permanece obrigatório.
- CLI/Arena/MCP não precisam expor memória nesta feature (somente store + embeddings + `/chat`), salvo se o plano adicionar superfície mínima para `remember`/`forget` via ferramenta do agente — default: composição `/chat` + API do store testável; exposição como tool do agente é opcional no plano.
- Política exata de `remember` em caso de near-duplicate (ignorar vs. atualizar `created_at`) é detalhe de plano; a spec exige apenas ausência de duplicata redundante.
