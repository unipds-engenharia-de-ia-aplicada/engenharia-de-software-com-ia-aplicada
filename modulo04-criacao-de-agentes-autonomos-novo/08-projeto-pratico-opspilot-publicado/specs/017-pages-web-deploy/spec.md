# Feature Specification: Deploy War Room no GitHub Pages

**Feature Branch**: `017-pages-web-deploy`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Deploy do web/ no Pages via Actions: upload-pages-artifact + deploy-pages, permissions, README (atualizar)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Publicar a War Room Automaticamente (Priority: P1)

Um mantenedor envia mudanças da interface web para o repositório e, sem passos manuais de hospedagem, a War Room estática é publicada no GitHub Pages — para que plantonistas e revisores abram a UI por um URL HTTPS estável.

**Why this priority**: Sem publish automático, o `web/` só existe localmente; o valor de demo/plantão remoto não existe.

**Independent Test**: Disparar o workflow de deploy (push elegível ou disparo manual) e verificar que o job conclui com deploy Pages bem-sucedido e o artefato da build de `web/` é o que foi publicado.

**Acceptance Scenarios**:

1. **Given** o repositório com a app em `web/` e Pages configurado para GitHub Actions, **When** o workflow de deploy roda com sucesso, **Then** a War Room fica disponível no URL do GitHub Pages do repositório (caminho compatível com o base path da app).
2. **Given** uma alteração relevante em `web/` (ou disparo manual do workflow), **When** o pipeline executa, **Then** a build de produção de `web/` é gerada e publicada via o fluxo oficial de artefato Pages (`upload-pages-artifact`) seguido de `deploy-pages`.
3. **Given** um deploy bem-sucedido, **When** um visitante abre o URL documentado, **Then** a shell da War Room carrega (HTML/assets) sem 404 dos assets do base path.

---

### User Story 2 — Workflow com Permissões Corretas (Priority: P1)

O pipeline de Pages declara as permissões mínimas necessárias para publicar o site, evitando falhas de autorização e excesso de privilégio.

**Why this priority**: Sem `permissions` corretas, `deploy-pages` falha; permissões excessivas violam boa prática de segurança do repositório.

**Independent Test**: Inspecionar o workflow: presença de permissões exigidas pelo deploy Pages; job de deploy usa o ambiente/actions Pages padrão.

**Acceptance Scenarios**:

1. **Given** o workflow de Pages, **When** ele é lido/revisado, **Then** declara permissões suficientes para publicar Pages (no mínimo escrita em Pages e emissão de identidade OIDC conforme o contrato atual do `deploy-pages`).
2. **Given** o job de deploy, **When** executa, **Then** usa `actions/deploy-pages` após o upload do artefato, sem upload ad-hoc fora desse padrão.
3. **Given** dois deploys concorrentes, **When** ambos são disparados, **Then** a concorrência do workflow evita corrupção do site (grupo de concurrency documentado/aplicado no workflow).

---

### User Story 3 — README Orienta Acesso e Deploy (Priority: P2)

Quem clona ou visita o repositório encontra no README (raiz do projeto) como a War Room é publicada no Pages, qual URL usar e o que configurar no GitHub (source = GitHub Actions), sem depender só do README boilerplate do Vite em `web/`.

**Why this priority**: Documentação desbloqueia uso; secundário ao pipeline em si, mas pedido explícito do brief.

**Independent Test**: Abrir o README atualizado e localizar seção de Pages (URL, pré-requisito de settings, comando/local do workflow).

**Acceptance Scenarios**:

1. **Given** o README do repositório, **When** um novo contribuídor lê a seção de War Room / Pages, **Then** encontra o URL público (ou o padrão `https://<owner>.github.io/<repo>/…` com o path da app) e a instrução de habilitar Pages com source GitHub Actions.
2. **Given** o README, **When** alguém procura como o deploy funciona, **Then** há referência ao workflow de Actions e ao fato de que a API continua separada (URL configurável na engrenagem da War Room).
3. **Given** o README boilerplate antigo em `web/` (template Vite), **When** a feature conclui, **Then** ele é atualizado ou apontado para o README raiz, para não contradizer o fluxo Pages.

---

### Edge Cases

- O que acontece se a build de `web/` falha? O deploy Pages NÃO deve publicar artefato inválido; o workflow falha de forma visível.
- O que acontece se Pages ainda não está com source “GitHub Actions”? O workflow pode rodar mas o site não fica público até a configuração — README MUST avisar esse pré-requisito.
- O que acontece em PRs? Default: não publicar Pages a partir de PR (só branch padrão / disparo manual), para não sobrescrever o site de produção com cada PR.
- O que acontece com o base path `/opspilot/`? O site publicado MUST servir a app sob esse prefixo (ou o build MUST alinhar base ao path do Pages — documentado nas Assumptions; visitante usa o URL completo documentado).
- O que acontece se só arquivos fora de `web/` mudam? Default: workflow pode usar paths-filter ou rodar só em mudanças de `web/` / workflow / lockfile relevante, para economizar minutos (aceitável rodar sempre no push da branch padrão se mais simples — plano escolhe).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O repositório DEVE incluir um workflow GitHub Actions que faz build de produção do pacote `web/` e publica o resultado no GitHub Pages.
- **FR-002**: O workflow DEVE usar o par oficial `actions/upload-pages-artifact` + `actions/deploy-pages` (versões pinadas estáveis no plano).
- **FR-003**: O workflow DEVE declarar `permissions` adequadas ao deploy Pages (incluindo o necessário para `pages` e `id-token` conforme a documentação vigente das actions).
- **FR-004**: O artefato enviado ao Pages DEVE ser o output da build estática de `web/` (não o código-fonte TypeScript).
- **FR-005**: O deploy MUST ser acionável pelo menos por push à branch padrão (com escopo sensato) e por `workflow_dispatch`.
- **FR-006**: O README na raiz do repositório DEVE ser criado ou atualizado com: como habilitar GitHub Pages (source = GitHub Actions), URL esperado da War Room, e nota de que a API OpsPilot é configurada na UI (engrenagem), não embutida no Pages.
- **FR-007**: O README em `web/` DEVE deixar de ser apenas o template Vite genérico — atualizar para OpsPilot War Room ou redirecionar o leitor ao README raiz.
- **FR-008**: Falha na build de `web/` DEVE impedir o job de deploy (sem publicar site quebrado).
- **FR-009**: O site publicado DEVE carregar com o base path da War Room já definido em `web/` (`/opspilot/`), de forma que assets e rota inicial resolvam no Pages.

### Key Entities

- **PagesWorkflow**: Definição do pipeline (triggers, jobs build/deploy, permissions, concurrency).
- **StaticWarRoomArtifact**: Conteúdo de `web/dist` (ou equivalente) enviado como artefato Pages.
- **ProjectReadme**: Documentação raiz com URL Pages, setup e relação War Room ↔ API.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Após um workflow bem-sucedido, um visitante abre o URL Pages documentado e vê a War Room carregar em menos de 5 segundos em rede normal (shell + assets).
- **SC-002**: 100% dos deploys bem-sucedidos no teste de aceitação usam upload de artefato Pages + `deploy-pages` (não outro método de publish).
- **SC-003**: Revisão do workflow confirma permissões Pages/`id-token` presentes antes do merge da feature.
- **SC-004**: Um contribuídor encontra no README, em menos de 2 minutos, como habilitar Pages e qual URL usar.
- **SC-005**: Build falha → job de deploy não publica (verificável na definição do workflow / run de teste).

## Assumptions

- GitHub Pages do repositório usa source **GitHub Actions** (não branch `gh-pages` clássica).
- A War Room no Pages é só o frontend estático; a API Node continua a ser apontada via engrenagem (CORS já tratado em 016).
- Base path permanece `/opspilot/` (feature 016). O URL público documentado inclui esse path (ex. `https://<owner>.github.io/<repo>/opspilot/`), salvo o plano ajustar o base dinamicamente ao nome do repo — se houver conflito com o path do projeto Pages, o plano resolve sem mudar o valor de produto sem registro.
- Branch padrão = `main` (ou a default do repo); PRs não publicam o site de produção por padrão.
- Não há autenticação no site Pages v1.
- Nome curto da feature: `pages-web-deploy`.
