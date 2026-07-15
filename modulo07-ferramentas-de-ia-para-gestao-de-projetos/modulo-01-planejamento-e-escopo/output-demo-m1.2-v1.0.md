# Requirements Copilot - Output Demo U1.2
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 1.3**
> Gerado pela aplicação do `requirements-copilot-system-prompt.md` v1.1 à
> `transcricao-discovery-routewise.md` (RouteWise, 14/04/2025, 35min).
> Modelo: Gemini 3.1 Pro Preview | Temperatura: 0.3
> Artefato de referência para gravação — usar este arquivo em tela durante a demo.

---

## 1. MAPA DE DOMÍNIOS

| Domínio | Descrição | Confiança |
|---|---|---|
| **Telemetria e Rastreamento** | Captura e processamento de coordenadas GPS e dados de sensores em tempo real. | Alta |
| **Gestão de Alertas e Escalação** | Motor de regras para notificações de segurança e fluxo hierárquico de resposta. | Alta |
| **Gestão de Ativos (Hardware)** | Monitoramento da saúde, conectividade e bateria dos dispositivos GPS. | Média |
| **Analytics e Reporting** | Consolidação de indicadores operacionais para diretoria e RH. | Alta |
| **Integração de Terceiros** | Sincronização de dados de conduta com o sistema de gestão de pessoas (RH). | Baixa |

---

## 2. MAPA DE STAKEHOLDERS

| Nome/Papel | Tipo | Requisitos que defendem | Conflitos / Observações |
|---|---|---|---|
| Carlos (Dir. Operações) | Negócio | Redução de multas/acidentes, Dashboards automáticos, Regras configuráveis. | [CONFLITO] Deseja dados de acelerômetro, mas possui frota com hardware incompatível. |
| Operador de Despacho | Usuário Final | Visualização do mapa em tempo real e alertas imediatos. | Foco em usabilidade e baixa latência. |
| Técnico de Dispositivos | Usuário Final | Visibilidade sobre status de conexão e bateria dos rastreadores. | Foco em manutenção preventiva do hardware. |
| RH | Negócio | Recebimento de ocorrências para avaliação de motoristas. | [VALIDAR COM EQUIPE] Necessidade de integração (API vs Manual). |
| Diretor (Board) | Negócio | Relatórios semanais de performance e segurança. | Stakeholder do prazo (Board de Julho). |

---

## 3. ESTRUTURA DE ÉPICOS

| Título | Descrição | Complexidade | Justificativa |
|---|---|---|---|
| E01: Motor de Alertas Críticos | Detecção de velocidade e frenagem com fluxo de escalação. | G | Exige processamento de baixa latência e motor de regras variável por rota/veículo. |
| E02: Monitoramento de Saúde da Frota | Dashboard de status dos dispositivos (online/offline/bateria). | M | Complexidade média devido à heterogeneidade do hardware (modelos novos vs antigos). |
| E03: Portal de Inteligência Operacional | Dashboards automatizados para diretoria e exportação para RH. | M | Envolve agregação de dados e automação de processos hoje manuais em Excel. |

---

## 4. USER STORIES

**US01 — Alerta de Excesso de Velocidade Configurável**

Card: Como operador de despacho, quero ser alertado em tempo real quando um veículo exceder o limite de velocidade específico daquela via ou tipo de veículo, para que eu possa intervir imediatamente.

Validação INVEST:
- [INVEST-FAIL: Small] — A história exige integração com base de limites de velocidade por via e tratamento de regras distintas por categoria de veículo, ultrapassando o escopo de um sprint.

Critérios de Aceite:
Cenário: Detecção de excesso de velocidade em tempo real
  Dado que o veículo "Caminhão-01" tem um limite de 80km/h definido para a rodovia atual
  Quando o dispositivo enviar uma telemetria de 85km/h
  Então o sistema deve gerar um alerta visual no dashboard em menos de [A CONFIRMAR] segundos

Cenário: Regra diferenciada por tipo de veículo
  Dado que uma "Van Leve" e um "Caminhão Pesado" estão na mesma via
  Quando ambos excederem seus respectivos limites (distintos entre si)
  Então o sistema deve disparar alertas independentes baseados na categoria do veículo

---

**US02 — Escalação Hierárquica de Alertas**

Card: Como gestor de frota, quero que alertas não reconhecidos pelo supervisor sejam escalados para a coordenação, para garantir que riscos de segurança não sejam ignorados.

Validação INVEST:
- [INVEST-FAIL: Estimable] — O tempo de "uns minutos" para escalação é ambíguo e impede estimativa de complexidade.

Critérios de Aceite:
Cenário: Escalação por falta de atendimento
  Dado que um alerta de velocidade foi gerado para o Supervisor da Rota A
  Quando o alerta não for marcado como "Ciente" em até [A CONFIRMAR] minutos
  Então o sistema deve enviar uma notificação de alta prioridade para o Coordenador de Turno

---

**US03 — Monitoramento de Conectividade do Dispositivo**

Card: Como técnico de dispositivos, quero identificar rastreadores que pararam de enviar sinal, para distinguir entre falha de hardware e falta de cobertura.

Validação INVEST:
- [INVEST-FAIL: Small] — Exige lógica de timeout e tratamento de dados inconsistentes entre modelos de hardware (novos com telemetria de bateria vs. antigos sem), o que requer decisão arquitetural prévia.

Critérios de Aceite:
Cenário: Dispositivo offline por tempo prolongado
  Dado que um veículo está em operação
  Quando o sistema não receber pacotes de dados por mais de [A CONFIRMAR] minutos
  Então o status do dispositivo deve mudar para "Offline - Crítico" no mapa

Cenário: Bateria baixa (apenas dispositivos novos)
  Dado que o dispositivo suporta telemetria de bateria
  Quando o nível de bateria reportado for inferior a 15%
  Então o sistema deve exibir ícone de "Bateria Crítica" no dashboard técnico

---

## 5. PERGUNTAS EM ABERTO

1. Qual o SLA de "tempo real"? → Impacto: arquitetura de mensageria e custo de infraestrutura.
2. Qual o tempo exato (em minutos) para a escalação do alerta? → Impacto: configuração do motor de workflow.
3. O sistema de RH possui API disponível? → Impacto: viabilidade de integração automática vs. exportação CSV.
4. Como o sistema deve se comportar para os 140 veículos quanto à frenagem brusca, dado que nem todos têm acelerômetro? → Impacto: experiência do usuário e consistência dos relatórios.
5. Qual o tempo de inatividade (timeout) para considerar um dispositivo como "Offline"? → Impacto: volume de alertas falsos-positivos em áreas de sombra de sinal.

---

## 6. FLAGS DE RISCO

- [ESPECIFICAÇÃO INVENTADA] — Tempos de latência e timeouts marcados como [A CONFIRMAR]. Nenhum valor inventado.
- [DEPENDÊNCIA NÃO MAPEADA] — US01 pressupõe base de dados de limites de velocidade por via (GIS/Maps API) não confirmada.
- [VIABILIDADE TÉCNICA SILENCIOSA] — Acelerômetro para frenagem brusca impossível em hardware antigo. Dados parciais podem enviesar avaliação de motoristas no RH.
- [GOLD PLATING] — Manutenção preditiva removida do backlog: tratada como "fase 2" com dados de entrada não estruturados.

---

## 7. CARDS PRONTOS PARA JIRA

Épico: E01: Motor de Alertas Críticos
Feature: Alertas de Velocidade
Título: Como operador de despacho, quero alerta de velocidade por tipo de veículo
Tipo: Story | Story Points: 8 | Labels: Telemetria, Segurança, G
Para que: Evitar multas e acidentes através de intervenção imediata.
Dependências: API de Mapas com limites de velocidade por via.
Definition of Ready: [⚠️ Pendente: Definição de latência e Provedor de Mapas]

---

Épico: E02: Monitoramento de Saúde da Frota
Feature: Status de Dispositivos
Título: Como técnico de dispositivos, quero monitorar nível de bateria e sinal
Tipo: Story | Story Points: 5 | Labels: Hardware, Manutenção, M
Para que: Identificar falhas de hardware antes que o veículo fique invisível no mapa.
Dependências: Cadastro de de-para de modelos (novo vs. antigo) por ID de dispositivo.
Definition of Ready: [⚠️ Pendente: Definição de timeout e cadastro de hardware]

---

## 8. DEPENDÊNCIAS NÃO DECLARADAS

- Provedor de Mapas (Speed Limits API) → Bloqueia US01 → Contratar e integrar API de limites de velocidade por geolocalização.
- Serviço de Mensageria (Push/WebSocket) → Bloqueia US01 e US02 → Necessário para entrega de alerta sem polling manual.
- Mapeamento de De-Para de Hardware → Bloqueia US03 → Cadastro identificando dispositivos novos vs. antigos por ID.
- Parecer Jurídico LGPD → Bloqueia todas as histórias → Base legal e consentimento antes do go-live.

---

## 9. DIAGRAMA DE FLUXO (Mermaid)

flowchart TD
    A[Dispositivo GPS] -->|Envia Telemetria| B{Motor de Regras}
    B -->|Velocidade > Limite| C[Gera Alerta Crítico]
    B -->|Sem sinal > X min| D[Gera Alerta Offline]
    C --> E[Notifica Operador]
    E --> F{Reconhecido em X min?}
    F -->|Não| G[Escala para Coordenador]
    F -->|Sim| H[Log de Incidente]
    D --> I[Notifica Técnico]
    H --> J[Dashboard Semanal]
    G --> J
    I --> J

---

> ⚠️ Este output é um rascunho analítico. Requer revisão humana antes de entrar em sprint.
> Valide: viabilidade técnica (especialmente frequência de envio dos dispositivos de 2016),
> compliance/LGPD e disponibilidade de API do sistema de RH.

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
