# Feature Specification: War Room Web

**Feature Branch**: `016-war-room-web`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "War room web/ (Vite+react+TS) com as instructions de design: chat -> /chat, com \"ver raciocínio\" abrindo o trace tipado. 202 vira cartão aprovar/negar; engrenagem com URL da API; base /opspilot/; CORS"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Plantonista Conversa na War Room (Priority: P1)

Um plantonista abre a War Room no navegador, digita uma mensagem operacional e vê a resposta do copiloto no fio da conversa — sem precisar de curl ou CLI — para conduzir o plantão a partir de uma tela única.

**Why this priority**: É o fluxo principal do produto web; sem chat funcional a War Room não entrega valor.

**Independent Test**: Com a API de chat disponível (ou fake em teste), abrir a War Room, enviar uma mensagem e verificar que a resposta aparece no histórico da conversa.

**Acceptance Scenarios**:

1. **Given** a War Room aberta e a URL da API configurada, **When** o plantonista envia uma mensagem, **Then** a UI chama o endpoint de chat da API e exibe a resposta no fio (mensagem do usuário + resposta do agente).
2. **Given** uma resposta de sucesso do chat, **When** o plantonista lê o fio, **Then** a resposta do agente está visível como conteúdo principal (não só metadados).
3. **Given** falha de rede ou erro HTTP recuperável, **When** o envio falha, **Then** a War Room mostra estado de erro no contexto do chat (o que falhou + o que tentar) sem deixar a área em branco.

---

### User Story 2 — Ver Raciocínio (Trace Tipado) (Priority: P1)

Após uma resposta, o plantonista precisa auditar o que o agente fez. Ele aciona “Ver raciocínio” e abre o trace tipado daquele turno — eventos estruturados, não um blob opaco — para validar tools, rotas e decisões.

**Why this priority**: Transparência operacional é o diferencial do OpsPilot; a War Room deve expor o mesmo raciocínio que a API já devolve.

**Independent Test**: Obter uma resposta que inclui trace; clicar “Ver raciocínio”; assertar que os eventos tipados do turno ficam legíveis (tipo, conteúdo/nó relevantes).

**Acceptance Scenarios**:

1. **Given** um turno com resposta de sucesso que inclui trace, **When** o plantonista aciona “Ver raciocínio”, **Then** a UI abre uma visão (painel/drawer/modal) mostrando os eventos do trace daquele turno.
2. **Given** o painel de raciocínio aberto, **When** o plantonista inspeciona os eventos, **Then** cada evento é apresentado de forma tipada (tipo reconhecível e campos relevantes), sem exigir conhecimento de JSON bruto — embora detalhe técnico possa coexistir de forma subordinada.
3. **Given** um turno sem trace ou trace vazio, **When** “Ver raciocínio” é acionado (ou o controle fica indisponível), **Then** a UI trata o caso com empty state claro (“sem eventos de raciocínio”) em vez de falhar silenciosamente.

---

### User Story 3 — Aprovar ou Negar Ação Pendente (202) (Priority: P1)

Quando o chat responde que uma ação está pendente de confirmação humana (HTTP 202), a War Room não trata isso como erro: mostra um cartão de decisão com Aprovar e Negar, para o plantonista autorizar ou recusar antes de seguir.

**Why this priority**: Gate humano em ações sensíveis; sem o cartão, o plantonista não consegue concluir o fluxo de confirmação na UI.

**Independent Test**: Simular resposta 202 do chat; verificar cartão com ações Aprovar/Negar; ao escolher, a decisão é enviada de volta à API e o fio reflete o resultado (ou o estado pendente é atualizado).

**Acceptance Scenarios**:

1. **Given** o envio de uma mensagem cujo chat retorna `202` com contexto da ação pendente, **When** a resposta chega, **Then** a War Room exibe um cartão de aprovação (não um erro genérico) com controles Aprovar e Negar.
2. **Given** o cartão pendente visível, **When** o plantonista escolhe Aprovar, **Then** a UI envia a decisão de aprovação à API e atualiza o fio/estado do cartão (pendente → aprovado ou resposta seguinte).
3. **Given** o cartão pendente visível, **When** o plantonista escolhe Negar, **Then** a UI envia a decisão de negação à API e atualiza o fio/estado do cartão (pendente → negado ou mensagem de cancelamento).
4. **Given** um cartão ainda pendente, **When** o plantonista tenta enviar outra mensagem no mesmo fluxo sem decidir, **Then** a UI impede ambiguidade (bloqueia novo envio ou deixa claro que há decisão pendente) — default: bloquear novo envio até decidir ou descartar explicitamente.

---

### User Story 4 — Configurar URL da API (Engrenagem) (Priority: P2)

O plantonista (ou quem sobe o demo) aponta a War Room para o servidor OpsPilot correto via ícone de engrenagem, sem rebuild, para usar API local, staging ou outro host.

**Why this priority**: Desbloqueia uso real fora de um único ambiente hardcoded; secundário ao chat em si.

**Independent Test**: Abrir configurações, alterar URL da API, salvar, enviar mensagem e verificar que a chamada vai para a URL configurada.

**Acceptance Scenarios**:

1. **Given** a War Room aberta, **When** o plantonista abre a engrenagem (configurações), **Then** vê um campo para a URL base da API e consegue salvar.
2. **Given** uma URL válida salva, **When** o plantonista envia uma mensagem, **Then** as chamadas de chat usam essa URL (prefixo configurável + path de chat).
3. **Given** URL inválida ou vazia ao salvar, **When** a validação falha, **Then** a UI mostra erro associado ao campo e não persiste valor inválido.

---

### User Story 5 — War Room Servida sob Base `/opspilot/` (Priority: P2)

A aplicação web é publicada sob o prefixo de caminho `/opspilot/`, para conviver com outros serviços no mesmo host sem conflitar com a raiz.

**Why this priority**: Requisito de deploy/integração do pedido; necessário para deep links e assets corretos.

**Independent Test**: Abrir a app em `/opspilot/` (e rotas internas sob esse prefixo) e verificar que a UI carrega (HTML/assets) sem 404 de caminho.

**Acceptance Scenarios**:

1. **Given** o frontend construído/servido com base `/opspilot/`, **When** o usuário navega para `/opspilot/`, **Then** a War Room carrega.
2. **Given** assets e rotas da SPA, **When** a página é recarregada em um path sob `/opspilot/`, **Then** a aplicação continua resolvendo assets e rota corretamente (sem quebrar o prefixo).

---

### User Story 6 — API Aceita Chamadas do Navegador (CORS) (Priority: P2)

O servidor HTTP do OpsPilot permite que a War Room (origem do browser) chame `/chat` e endpoints correlatos, sem bloqueio CORS no caminho feliz do plantão.

**Why this priority**: Sem CORS, a War Room no browser não fala com a API em origens distintas (dev tipico Vite ≠ porta da API).

**Independent Test**: A partir da origem da War Room, `POST /chat` (e chamada de decisão 202, se houver) completa sem erro de CORS no browser; preflight OPTIONS, quando exigido, responde adequadamente.

**Acceptance Scenarios**:

1. **Given** War Room em origem A e API em origem B, **When** o browser envia `POST /chat`, **Then** a API inclui cabeçalhos CORS que permitem a origem configurada (ou política documentada de origens permitidas) e a resposta é legível pela UI.
2. **Given** preflight `OPTIONS` exigido pelo browser, **When** a API recebe o preflight para rotas usadas pela War Room, **Then** responde de forma a autorizar o método/headers necessários ao chat e à decisão de aprovação.

---

### Edge Cases

- O que acontece se a API estiver offline? Empty/erro de conexão no chat com ação “tentar de novo”; sem spinner eterno.
- O que acontece se `200` vier sem `answer`? Tratar como erro de contrato na UI (mensagem clara), não crash.
- O que acontece se `202` vier sem dados suficientes para o cartão? Mostrar cartão degradado com aviso + Negar/descartar; não inventar ação.
- O que acontece ao recarregar a página com cartão pendente? Preferência v1: estado pendente não sobrevive ao reload (assumir novo turno); documentado em Assumptions.
- O que acontece se a URL da API tiver barra final duplicada? Normalizar ao montar paths (`/chat`) para evitar `//chat`.
- O que acontece em dark mode / reduced motion? Seguir as design instructions de `web/**` (tokens, contraste, motion).
- O que acontece com timeout longo do chat (até ~180s)? UI mostra estado de carregamento explícito no envio; permite cancelar a espera na UI (abort da request) sem corromper o fio.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE fornecer a War Room como aplicação web em `web/`, consumível no navegador sob o base path `/opspilot/`.
- **FR-002**: A War Room DEVE permitir enviar mensagens ao copiloto via o endpoint de chat da API (`/chat`) e exibir respostas no fio da conversa.
- **FR-003**: Para cada turno com trace disponível, a War Room DEVE oferecer a ação “Ver raciocínio” que abre a visualização do trace tipado daquele turno.
- **FR-004**: A visualização de raciocínio DEVE apresentar eventos de forma tipada (tipo do evento e campos relevantes), alinhada ao contrato de trace já exposto pela API.
- **FR-005**: Quando a API de chat responder `202` (ação pendente de confirmação), a War Room DEVE renderizar um cartão com ações Aprovar e Negar em vez de tratar como falha.
- **FR-006**: Aprovar e Negar DEVEM enviar a decisão do plantonista de volta à API (contrato de continuação) e atualizar o estado do cartão/fio de forma observável.
- **FR-007**: A War Room DEVE expor configuração via ícone de engrenagem para definir a URL base da API, persistida entre sessões no mesmo browser.
- **FR-008**: Chamadas da War Room DEVEM usar a URL base configurada como prefixo dos paths da API.
- **FR-009**: O servidor HTTP do OpsPilot DEVE habilitar CORS para as origens necessárias à War Room (dev e política documentada), cobrindo chat e decisão de aprovação.
- **FR-010**: A UI sob `web/` DEVE seguir as design instructions do repositório (hierarquia, escala de espaçamento, empty/error states, dark mode via tokens, acessibilidade).
- **FR-011**: Empty states e erros da War Room DEVEM ser conteúdo de primeira classe (título/mensagem/ação), distinguindo “ainda sem mensagens”, “falha de rede” e “filtro/resultado vazio” quando aplicável.
- **FR-012**: Controles interativos críticos (enviar, ver raciocínio, aprovar/negar, engrenagem) DEVEM ser operáveis por teclado e com foco visível.
- **FR-013**: A stack da War Room DEVE ser Vite + React + TypeScript em `web/`, conforme pedido explícito do feature brief (detalhe de tooling no plano).

### Key Entities

- **WarRoomSession**: Sessão de UI no browser — URL da API configurada, fio de mensagens da conversa atual, cartão de aprovação pendente (se houver).
- **ChatTurn**: Um turno usuário→agente — mensagem, resposta (ou pendência), trace tipado opcional, status HTTP observado (`200` / `202` / erro).
- **TypedTraceView**: Representação apresentável do `trace` do turno — sequência de eventos tipados para auditoria.
- **ApprovalCard**: Cartão derivado de resposta `202` — resumo da ação pendente, estado (pendente/aprovado/negado), ações Aprovar/Negar.
- **ApiEndpointConfig**: URL base da API persistida localmente e usada para montar chamadas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um plantonista consegue enviar uma mensagem e ver a resposta do agente na War Room em um único fluxo contínuo (abrir app → enviar → ler resposta), sem ferramentas externas.
- **SC-002**: Em 100% dos turnos de sucesso com trace no teste de aceitação, “Ver raciocínio” revela os eventos tipados daquele turno.
- **SC-003**: Em 100% das respostas `202` simuladas no teste de aceitação, a UI mostra cartão Aprovar/Negar (nunca um erro genérico de “falha no chat”).
- **SC-004**: Após configurar a URL da API pela engrenagem, a próxima mensagem usa a nova URL (verificável por inspeção de rede ou harness).
- **SC-005**: A War Room carrega corretamente sob o prefixo `/opspilot/` (entrada e reload de rota sob o prefixo sem assets quebrados).
- **SC-006**: Chamada browser da War Room para a API completa sem bloqueio CORS no caminho feliz documentado (chat + decisão de aprovação).
- **SC-007**: Estados vazios e de erro cobrem pelo menos: conversa vazia, falha de rede/API, e raciocínio sem eventos — cada um com mensagem acionável.

## Assumptions

- A API de chat existente (`POST /chat`) permanece a fonte de respostas `200` com `answer` + `trace` (+ campos já estabelecidos em specs anteriores).
- Resposta HTTP `202` significa “ação pendente de confirmação humana”; o corpo inclui contexto mínimo para o cartão (resumo/id de correlação). O contrato exato de request/response de Aprovar/Negar é detalhado no plano; se ainda não existir na API, esta feature o introduz na borda HTTP na medida necessária à War Room.
- Persistência do cartão pendente após reload está fora de escopo v1.
- Autenticação/autorização de usuários na War Room está fora de escopo v1 (ambiente confiável de plantão/demo).
- A URL da API é persistida no armazenamento local do browser; default apontando para o host de desenvolvimento documentado no quickstart/plano.
- Design: aplicar `.github/instructions/design.instructions.md` e a regra Cursor equivalente para tudo sob `web/`.
- Stack web pedida explicitamente: Vite + React + TypeScript; o backend continua na stack da constitution (Express/Node). CORS é mudança de borda HTTP, não mudança de domínio do agente.
- Escopo v1 da War Room: chat + raciocínio + aprovação 202 + config de URL. Listas de alertas/incidentes como telas próprias ficam fora (o chat/tools cobrem operações).
