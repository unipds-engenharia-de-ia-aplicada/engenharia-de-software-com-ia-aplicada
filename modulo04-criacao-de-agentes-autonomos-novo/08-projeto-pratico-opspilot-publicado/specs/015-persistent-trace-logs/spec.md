# Feature Specification: Trace Persistido + Logs JSON

**Feature Branch**: `015-persistent-trace-logs`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Trace persistido + logs JSON: /chat: requestId no corpo e no header X-Request-Id. SQLite: requests (métricas) e trace_events (node, payloads). src/obs/logger.ts: 1 linha JSON por evento, só metadados. GET /requests/:id registro + trace ordenado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Correlacionar Resposta do Chat com um Identificador (Priority: P1)

Um plantonista ou integrador chama `POST /chat` e precisa correlacionar a resposta com logs e auditoria posteriores. Cada execução bem-sucedida (e falhas que cheguem a ter id) expõe o mesmo `requestId` no corpo JSON e no header `X-Request-Id`.

**Why this priority**: Sem identificador estável na resposta, persistência e consulta por id não têm âncora; é o contrato de correlação da feature.

**Independent Test**: Com estratégia/grafo fake (sem rede), chamar `POST /chat` e assertar que `body.requestId` === header `X-Request-Id` e que o id é não-vazio e estável para aquela resposta.

**Acceptance Scenarios**:

1. **Given** o servidor de chat ativo, **When** o cliente envia `POST /chat` válido e recebe `200`, **Then** o corpo inclui `requestId` (string não vazia) e o header `X-Request-Id` carrega exatamente o mesmo valor.
2. **Given** duas chamadas `POST /chat` sucessivas, **When** ambas concluem, **Then** cada uma recebe um `requestId` distinto.
3. **Given** uma resposta de erro HTTP após o id já ter sido atribuído (ex. falha de modelo traduzida na borda), **When** o cliente inspeciona a resposta, **Then** o header `X-Request-Id` (e o corpo, se o contrato de erro o incluir) permite correlacionar a tentativa.

---

### User Story 2 — Auditar uma Execução Persistida (Priority: P1)

Após um turno de chat, o plantonista (ou suporte) consulta `GET /requests/:id` e recupera o registro da requisição (métricas e metadados do turno) mais a sequência ordenada de eventos de trace — incluindo nó de origem e payloads — para entender o que o agente fez.

**Why this priority**: É o valor de auditoria: o trace deixa de ser efêmero na resposta HTTP e passa a ser recuperável.

**Independent Test**: Executar um `/chat` com fake determinístico que emite N eventos de trace; em seguida `GET /requests/{requestId}` e assertar registro + lista ordenada igual à do turno.

**Acceptance Scenarios**:

1. **Given** um `POST /chat` que concluiu e persistiu, **When** o cliente chama `GET /requests/:id` com o `requestId` retornado, **Then** recebe `200` com o registro da requisição (métricas do turno e metadados mínimos) e o `trace` ordenado na ordem de emissão.
2. **Given** eventos de trace com `node` e conteúdo/payload, **When** o cliente lê `GET /requests/:id`, **Then** cada evento preserva tipo, nó, conteúdo e demais campos necessários à auditoria (sem reordenar).
3. **Given** um `id` inexistente, **When** `GET /requests/:id` é chamado, **Then** a API responde `404` sem inventar registro.

---

### User Story 3 — Operador Segue o Fluxo em Logs Estruturados (Priority: P2)

Durante o plantão, quem observa o processo (stdout/stderr ou agregador de logs) vê **uma linha JSON por evento** de log, contendo apenas metadados correlacionáveis (`requestId`, tipo de evento, nó, status, latência, etc.) — sem despejar payloads completos de mensagem/trace no log.

**Why this priority**: Observabilidade operacional em tempo real; complementa a persistência (payloads ricos no store; logs enxutos).

**Independent Test**: Disparar um `/chat` fake e capturar linhas emitidas pelo logger; assertar JSON parseável por linha, presença de metadados-chave e ausência de corpos/payloads de mensagem no log.

**Acceptance Scenarios**:

1. **Given** o logger estruturado ativo, **When** ocorre um evento de ciclo de vida do request (início, fim, erro), **Then** é emitida exatamente uma linha por evento, parseável como JSON.
2. **Given** um turno com vários eventos de trace, **When** os logs são inspecionados, **Then** cada linha de log traz metadados (ex. `requestId`, nível, nome do evento, `node` quando aplicável) e **não** inclui o texto completo da mensagem do usuário nem payloads volumosos do trace.
3. **Given** falha no turno, **When** o logger emite o evento de erro, **Then** a linha JSON inclui metadados suficientes para correlacionar com o `requestId` sem stack crua obrigatória no mesmo campo de mensagem.

---

### User Story 4 — Persistência Sobrevive ao Processo (Priority: P2)

O store de requests/trace usa a mesma persistência SQLite do produto. Após reinício do processo no mesmo arquivo de dados, `GET /requests/:id` ainda devolve o registro e o trace gravados antes do restart.

**Why this priority**: Auditoria útil em demo/plantão contínuo; alinha à constitution (SQLite via `node:sqlite`).

**Independent Test**: Gravar um request em arquivo (não `:memory:`), reiniciar o processo apontando para o mesmo `OPSPILOT_DB`, consultar por id — dados presentes.

**Acceptance Scenarios**:

1. **Given** `OPSPILOT_DB` apontando para arquivo e um chat concluído, **When** o processo reinicia com o mesmo caminho, **Then** `GET /requests/:id` retorna o mesmo registro e trace.
2. **Given** testes automatizados, **When** a suíte de persistência/HTTP roda, **Then** usa `:memory:` (ou equivalente isolado) sem sujar o arquivo default.

---

### Edge Cases

- O que acontece se a persistência falhar após o chat já ter resposta? O sistema MUST ainda devolver a resposta do chat ao cliente quando possível; o erro de persistência MUST ser logado com metadados (e não derrubar silenciosamente a correlação do `requestId` já emitido). Preferência: best-effort de gravação, falha observável nos logs.
- O que acontece se `GET /requests/:id` receber id malformado (vazio, caracteres inválidos)? MUST responder `400` ou `404` de forma consistente e documentada (default: `400` se formato inválido; `404` se formato ok e ausente).
- O que acontece em `POST /chat` com validação `400` antes de executar o agente? MAY omitir persistência de trace; se `requestId` for atribuído na entrada, MUST aparecer no header mesmo em `400`.
- O que acontece com concorrência de vários `/chat`? Cada request MUST ter id próprio; eventos de um id MUST não misturar com outro na consulta.
- O que acontece se o trace for vazio (estratégia fake sem eventos)? O registro da request MUST existir; `trace` MUST ser lista vazia ordenável.
- Payloads sensíveis: logs MUST restringir-se a metadados; payloads detalhados ficam no store de `trace_events`, não nas linhas de log.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Em `POST /chat`, o sistema MUST gerar um `requestId` único por requisição e devolvê-lo no corpo da resposta de sucesso junto aos campos já existentes (`answer`, `trace`, `metrics`, etc.).
- **FR-002**: O mesmo `requestId` MUST ser enviado no header HTTP `X-Request-Id` da resposta de `/chat` (sucesso e, quando o id já existir, erros pós-atribuição).
- **FR-003**: O sistema MUST persistir cada execução de chat auditável em SQLite (via `node:sqlite` / `DatabaseSync`, caminho `OPSPILOT_DB`, testes em `:memory:`) em uma tabela `requests` contendo ao menos: identificador, timestamps, status/outcome, e métricas do turno.
- **FR-004**: O sistema MUST persistir os eventos de trace em uma tabela `trace_events` ligada ao `requestId`, preservando ordem de emissão, `node`, tipo, conteúdo e payloads necessários à auditoria.
- **FR-005**: O DDL das tabelas `requests` e `trace_events` MUST ser idempotente na inicialização do store (sem destruir dados existentes).
- **FR-006**: O sistema MUST expor `GET /requests/:id` que retorna o registro da request e o trace ordenado; `404` se o id não existir.
- **FR-007**: O módulo `src/obs/logger.ts` MUST emitir logs estruturados: **uma linha JSON por evento**, contendo apenas metadados correlacionáveis (sem payloads completos de mensagem/trace).
- **FR-008**: Eventos de log de request MUST incluir o `requestId` quando disponível, permitindo cruzar log ↔ resposta HTTP ↔ `GET /requests/:id`.
- **FR-009**: A gravação de request + trace_events MUST ocorrer ao final do turno de chat (sucesso) e, quando fizer sentido, em falhas que já tenham produzido métricas/trace parciais (best-effort documentado).
- **FR-010**: Entrada de `GET /requests/:id` MUST ser validada na fronteira; resposta MUST ser tipada/contrato estável para o cliente.
- **FR-011**: Testes MUST cobrir: correlação body/header do `requestId`; persistência + leitura ordenada; `404`; formato de uma linha JSON do logger sem payloads; uso de `:memory:` nos testes.

### Key Entities

- **RequestRecord**: Uma execução de `/chat` auditável — `requestId`, momento de início/fim, status, métricas (chamadas, tokens/latência conforme domínio atual), referências opcionais (rota/estratégia efetivas).
- **TraceEventRecord**: Um passo do raciocínio persistido — ordem, tipo, `node`, conteúdo, payload/estruturas auxiliares, FK para `RequestRecord`.
- **LogEvent**: Linha de observabilidade em tempo real — nível, nome do evento, `requestId`, metadados curtos; sem duplicar o payload completo do store.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das respostas `200` de `/chat` sob teste, `requestId` do corpo coincide com `X-Request-Id`.
- **SC-002**: Após um chat com N eventos de trace (N ≥ 1), `GET /requests/:id` devolve exatamente N eventos na mesma ordem em ≤ 2 segundos em ambiente local de teste.
- **SC-003**: Consulta a id inexistente retorna `404` em 100% dos casos de teste.
- **SC-004**: 100% das linhas emitidas pelo logger estruturado nos testes de observabilidade são JSON de uma linha e passam no assert “sem campo de payload/mensagem completa”.
- **SC-005**: Após reinício do processo no mesmo arquivo de dados, um request gravado antes do restart permanece recuperável via `GET /requests/:id` (cenário de aceitação manual ou teste de arquivo temporário).

## Assumptions

- `requestId` é gerado no servidor (UUID v4 ou equivalente opaco); o cliente não precisa enviar o id na request nesta versão.
- Persistência de auditoria reutiliza o mesmo banco `OPSPILOT_DB` do store operacional (tabelas novas ao lado de `services`/`alerts`/…); não exige segundo arquivo.
- Autenticação/autorização em `GET /requests/:id` fica fora de escopo (mesmo nível de exposição local do `/chat` atual).
- Retenção/TTL e limpeza automática de requests antigos ficam fora de escopo v1.
- “Só metadados” no logger significa: ids, tipos, nós, status, contagens, latências, códigos de erro — não o texto integral da pergunta do usuário nem o dump completo do trace.
- Payloads ricos (conteúdo dos eventos) vivem em `trace_events`; a resposta síncrona de `/chat` continua incluindo `trace` em memória como hoje, além da persistência.
- Falha de escrita no store de auditoria não deve, por padrão, transformar um turno já respondido em 5xx; deve ser observável via log.
- Esta feature depende do contrato atual de `/chat` (trace + metrics) e do carimbo `node` nos eventos (grafo de produção / strategies).
