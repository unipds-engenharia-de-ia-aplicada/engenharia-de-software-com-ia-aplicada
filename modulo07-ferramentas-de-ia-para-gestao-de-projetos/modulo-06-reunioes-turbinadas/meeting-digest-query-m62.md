# Meeting Digest Query - Sprint Review S2 — RouteWise
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 6.2**
> Query pré-preenchida para a demo ao vivo. Cole no campo de mensagem do usuário no AI Studio após configurar o system prompt (`meeting-digest-prompt.md`).

---

## Query (mensagem do usuário)

```
## METADADOS DA REUNIÃO

- Título da reunião: Sprint Review — Sprint 2 — RouteWise
- Data: 28/04/2026
- Duração aproximada: 20 minutos
- Participantes e papéis:
  - Carlos Mendonça: Diretor de Operações (decisor)
  - Marcus: Tech Lead / Consultor (facilitador técnico)
  - Ana Lima: Gestão de Pessoas / RH (stakeholder com novo pedido)
- Projeto / contexto: Sistema de gestão de frota para 140 veículos — Sprint 2 encerrado, revisão de entregas e ajustes de backlog

---

## TRANSCRIÇÃO

[COLE AQUI O CONTEÚDO DO BLOCO DE CÓDIGO DE transcricao-sprint-review-s2.md]

---

## ANÁLISE SOLICITADA

### 1. Resumo Executivo

Gere um resumo em 4 a 6 bullets. Cada bullet deve:
- Descrever uma decisão, alinhamento ou blocker relevante
- Ser compreensível por alguém que não estava na reunião
- Não usar jargão técnico sem explicação

### 2. Tabela de Ações

Para cada ação identificada na reunião, gere uma linha com:

| ID | Ação | Responsável | Prazo | Prioridade | Observação |
|---|---|---|---|---|---|

Regras de preenchimento:
- Responsável: use o nome mencionado explicitamente. Se não foi mencionado, preencha como **[A DEFINIR]** — nunca invente responsável
- Prazo: use a data mencionada. Se foi implícita ("antes da próxima reunião"), descreva em palavras. Se não foi mencionada, preencha como **[A DEFINIR]**
- Prioridade: Alta / Média / Baixa — baseie no contexto e urgência mencionados
- Observação: qualquer contexto adicional que ajuda na execução

### 3. Decisões Registradas

Liste todas as decisões tomadas na reunião — explícitas e implícitas. Uma decisão implícita é quando um tópico foi levantado e não gerou objeção, sinalizando acordo por omissão.

Para cada decisão:
- **Decisão:** o que foi decidido
- **Contexto:** por que foi decidido assim
- **Impacto:** o que muda por causa dessa decisão

### 4. Perguntas em Aberto

Liste itens que foram levantados mas não resolvidos na reunião. Para cada um:
- A pergunta ou incerteza
- Quem deveria responder (se mencionado)
- Se é blocker para alguma ação da tabela acima

### 5. JSON para Importação no Jira

Para cada ação da tabela com responsável definido, gere um objeto JSON no formato especificado.
```

---

## Output esperado na demo

> Veja `output-digest-backup-sprint-review-m62.md` para o backup completo gerado em pré-gravação.

Resumo Executivo (referência — output de 2026-07-10):
- US-02 Manutenção Preditiva entregue como contorno manual — time de campo já gerando histórico de dados estruturado
- Score de Motoristas e Sensor de Baú bloqueados — fornecedor de hardware pediu mais duas semanas para o orçamento
- US-05 Dashboard Base de Monitoramento reintegrado ao escopo com prioridade alta — apresentação da diretoria no próximo trimestre
- US-06 Painel de Motoristas criado a pedido do RH — desenvolvimento pausado até resolução da dependência de hardware
- Lead Time 7,1 dias levemente acima da meta (baseline 6,5), aceito pela diretoria; um erro não crítico pendente para o próximo ciclo

Tabela de Ações (referência — output de 2026-07-10):

| ID | Ação | Responsável | Prazo | Prioridade |
|---|---|---|---|---|
| 1 | Estimar esforço para o US-05 (Dashboard Base de Monitoramento) | Marcus | Amanhã (29/04) | Alta |
| 2 | Detalhar requisitos do Painel de Motoristas (US-06) para o RH | Ana Lima | Antes do Sprint Planning 3 | Média |
| 3 | Enviar template padronizado da planilha de histórico de manutenção | Marcus | Sexta-feira (01/05) | Média |
| 4 | Validar o template da planilha de manutenção com o time de campo | Carlos Mendonça | [A DEFINIR] | Média |
| 5 | Monitorar o Lead Time médio das entregas | Marcus | [A DEFINIR] | Baixa — [ACOMPANHAMENTO], não vira card |

> **Nota:** hardware sem prazo do fornecedor vai para Perguntas em Aberto — Carlos não assumiu o follow-up explicitamente na reunião. Perguntas em Aberto tem 1 item (hardware); a ação 5 fica fora do JSON por ser tarefa contínua sem entregável.

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
