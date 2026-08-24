# Feature Specification: Status de Provedores Externos

**Feature Branch**: `005-provider-status-tool`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Tool de status de provedores externos: Tool check_provider_status em src/agents/tools.ts: consulta a statuspage pública do provedor via API statuspage.io (sem chave): github -> https://www.githubstatus.com/api/v2/status.json; cloudflare -> https://www.cloudflarestatus.com/api/v2/status.json. Parâmetro provider (enum: github | cloudflare, default \"github\", .describe explicando). Descrição orientada a quando usar: suspeita de problema externo, \"é o nosso ou do provedor?\", dependência fora do ar. Resiliência: timeout de 5s via AbortSignal.timeout; falha de rede ou 5xx, UMA nova tentativa; resposta validada com zod ({ status: { indicator, description } }); qualquer falha final retorna string de erro legível como resultado da tool (erro é observação — nunca lançar exceção para fora da tool). Retorno compacto (indicador + descrição, uma linha), para não inflar o contexto. Teste: a função de fetch é injetável; testes cobrem sucesso, timeout e resposta inválida sem uso de rede (fake fetch)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Plantonista Distingue Falha Interna de Provedor (Priority: P1)

Durante um incidente, o plantonista (via agente) suspeita que a causa seja externa — GitHub ou Cloudflare fora do ar. Ele pergunta se o problema é “nosso ou do provedor”; o agente consulta o status público do provedor e responde com indicador e descrição oficiais, em uma linha, sem inventar estado.

**Why this priority**: É o valor central — reduzir falso positivo interno e acelerar triagem quando a dependência externa é a suspeita.

**Independent Test**: Invocar `check_provider_status` com fetch fake que devolve payload válido de status; assertar retorno compacto (indicador + descrição) sem rede real.

**Acceptance Scenarios**:

1. **Given** o agente com a tool registrada e um provedor com statuspage saudável, **When** o plantonista pergunta se GitHub está fora (ou omite o provedor), **Then** a tool usa `github` por padrão e retorna uma linha com indicador e descrição oficiais.
2. **Given** a mesma tool, **When** o plantonista pede status de Cloudflare (`provider=cloudflare`), **Then** a consulta usa a statuspage da Cloudflare e o retorno compacto reflete o indicador/descrição dessa página.
3. **Given** a descrição da tool, **When** o modelo decide se deve chamá-la, **Then** a descrição deixa claro o gatilho: suspeita de problema externo, dúvida “é o nosso ou do provedor?”, dependência fora do ar.

---

### User Story 2 — Falha Externa Vira Observação, Não Quebra o Grafo (Priority: P2)

Se a statuspage não responde a tempo, retorna 5xx ou devolve JSON inválido, o agente ainda precisa continuar o raciocínio. A tool devolve uma string de erro legível como resultado (observação), sem lançar exceção para fora.

**Why this priority**: Ferramentas que quebram o grafo degradam o plantão; erro como observação é padrão do projeto.

**Independent Test**: Com fetch fake, simular timeout, 5xx e payload inválido; assertar string de erro legível e que nenhuma exceção escapa da tool.

**Acceptance Scenarios**:

1. **Given** a consulta demora além de 5 segundos, **When** a tool é invocada, **Then** aborta por timeout, faz no máximo uma nova tentativa, e se ainda falhar retorna string de erro legível (sem throw).
2. **Given** resposta HTTP 5xx ou falha de rede na primeira tentativa, **When** a tool roda, **Then** há exatamente uma nova tentativa; se a segunda também falhar, retorna erro legível.
3. **Given** resposta HTTP bem-sucedida com corpo que não casa com o schema esperado (`status.indicator` + `status.description`), **When** a tool valida o payload, **Then** retorna erro legível (sem throw) e não propaga dados inválidos ao contexto.

---

### User Story 3 — Desenvolvedor Testa Sem Rede (Priority: P3)

Quem desenvolve precisa cobrir sucesso, timeout e resposta inválida com fetch injetável (fake), sem chamar as statuspages reais.

**Why this priority**: Princípio “teste é parte da tarefa”; statuspages públicas são flaky e não devem entrar na suíte CI.

**Independent Test**: Executar testes unitários da tool com fake fetch; suíte passa offline.

**Acceptance Scenarios**:

1. **Given** fake fetch que devolve JSON válido statuspage.io, **When** o teste de sucesso roda, **Then** o resultado é a linha compacta com indicador e descrição.
2. **Given** fake fetch que aborta/timeout, **When** o teste de timeout roda, **Then** a tool retorna erro legível após a política de retry (sem rede).
3. **Given** fake fetch que devolve corpo inválido, **When** o teste de validação roda, **Then** a tool retorna erro legível e o teste não usa rede.

---

### Edge Cases

- O que acontece se `provider` for omitido? MUST usar default `github`.
- O que acontece se `provider` for valor fora do enum (`github` | `cloudflare`)? MUST falhar na validação de fronteira do schema da tool (antes do fetch).
- O que acontece se a primeira tentativa falha e a segunda sucede? MUST retornar o status compacto da segunda tentativa (sem mencionar retry no retorno de sucesso, a menos que útil — preferir retorno limpo).
- O que acontece se o JSON tiver campos extras além de `status.indicator`/`status.description`? MUST aceitar (validação permissiva nos campos obrigatórios) e retornar só indicador + descrição.
- O que acontece se a statuspage retornar 4xx (ex.: 404)? MUST tratar como falha final legível (retry apenas para rede/5xx, conforme input; 4xx não merece retry).
- O que acontece se o indicador for `none` / `minor` / `major` / `critical` (vocabulário statuspage)? MUST repassar o valor oficial no retorno compacto, sem normalizar para outro enum interno nesta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST expor a tool `check_provider_status` no catálogo de tools do agente (`src/agents/tools.ts` / composição existente).
- **FR-002**: A tool MUST aceitar parâmetro `provider` com enum `github` | `cloudflare`, default `github`, e `.describe` explicando o significado do parâmetro.
- **FR-003**: A descrição da tool MUST orientar o modelo sobre quando usá-la: suspeita de problema externo; dúvida “é o nosso ou do provedor?”; dependência fora do ar.
- **FR-004**: Para `github`, a tool MUST consultar `https://www.githubstatus.com/api/v2/status.json` (API pública statuspage.io, sem chave).
- **FR-005**: Para `cloudflare`, a tool MUST consultar `https://www.cloudflarestatus.com/api/v2/status.json` (idem, sem chave).
- **FR-006**: Cada tentativa de fetch MUST respeitar timeout de 5 segundos (`AbortSignal.timeout` ou equivalente).
- **FR-007**: Em falha de rede ou resposta HTTP 5xx, a tool MUST realizar exatamente uma nova tentativa; demais falhas (timeout esgotado nas tentativas, 4xx, validação) MUST resultar em erro legível sem novas tentativas além da política definida.
- **FR-008**: A resposta HTTP bem-sucedida MUST ser validada com schema zod contendo `{ status: { indicator, description } }` (campos string); payload inválido MUST virar erro legível.
- **FR-009**: Em sucesso, a tool MUST retornar string compacta de uma linha com indicador e descrição (ex.: `none — All Systems Operational`), para não inflar o contexto do agente.
- **FR-010**: Qualquer falha final MUST retornar string de erro legível como resultado da tool; a tool MUST NÃO lançar exceção para fora (erro é observação).
- **FR-011**: A função de fetch MUST ser injetável (dependency injection / parâmetro opcional) para testes sem rede.
- **FR-012**: DEVE existir cobertura de testes para sucesso, timeout e resposta inválida, usando fake fetch, sem acesso à rede real.

### Key Entities

- **ProviderStatus**: Resultado oficial de status de um provedor suportado; atributos relevantes: `provider` (github | cloudflare), `indicator`, `description`.
- **ProviderStatusQuery**: Pedido do agente com `provider` opcional (default github); mapeia para a URL pública da statuspage correspondente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em cenário com statuspage saudável (simulado), o agente obtém indicador + descrição oficiais em uma única linha de observação em ≥ 95% das invocações bem-sucedidas da tool.
- **SC-002**: Quando a consulta externa falha (timeout, 5xx ou payload inválido), 100% das invocações devolvem erro legível como observação — zero exceções não tratadas saindo da tool.
- **SC-003**: Após uma falha transitória (rede/5xx) seguida de sucesso na segunda tentativa, o plantonista recebe o status compacto sem precisar repetir a pergunta.
- **SC-004**: A suíte de testes da tool cobre sucesso, timeout e resposta inválida e passa integralmente sem rede externa.
- **SC-005**: O plantonista consegue responder à dúvida “é nosso ou do provedor?” para GitHub e Cloudflare usando apenas esta tool (dois provedores no escopo v1).

## Assumptions

- Apenas GitHub e Cloudflare entram no escopo v1; outros provedores (AWS, Stripe, etc.) ficam fora até nova feature.
- As statuspages públicas seguem o contrato statuspage.io `/api/v2/status.json` com `status.indicator` e `status.description` como strings.
- Não é necessária autenticação/API key; uso é somente leitura da página pública.
- Retry: exatamente uma nova tentativa só para falha de rede ou HTTP 5xx; timeout conta como falha elegível a retry (uma nova tentativa após timeout da primeira).
- Respostas 4xx não são retentadas.
- Descrições de tools seguem as 6 regras já adotadas no projeto (quando usar; o que retorna; o que não fazer; defaults; enums com `.describe`; erros como observação).
- A tool integra-se ao catálogo existente usado pelas estratégias (ReAct / plan-and-execute); não altera o contrato HTTP `/chat`.
- Retorno compacto é texto livre de uma linha; não precisa ser JSON estruturado no resultado da tool.
