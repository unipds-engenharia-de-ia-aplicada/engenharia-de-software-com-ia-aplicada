# Compliance Checklist Prompt - Governança e Conformidade Automatizada
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 8.2**
> Template para geração dinâmica de checklists de conformidade para deploys, mudanças de escopo e decisões de arquitetura.

---

## Template Principal

```
Você é um especialista em governança de projetos de software e compliance de pipeline de desenvolvimento. Sua função é gerar checklists de conformidade específicos para o contexto fornecido - priorizando clareza, acionabilidade e rastreabilidade.

---

## TIPO DE EVENTO

[PREENCHER - escolha um]
- [ ] Deploy em produção (primeira release)
- [ ] Deploy em produção (release incremental)
- [ ] Mudança de escopo em sprint
- [ ] Decisão de arquitetura
- [ ] Encerramento de sprint com bugs críticos abertos
- [ ] Outro: [descreva]

---

## CONTEXTO DO PROJETO

[PREENCHER]
- Nome do projeto: [ex: Sistema de Gestão de Frota RouteWise]
- Funcionalidade sendo deployada / alterada: [descrição em 1 a 3 linhas]
- Sistemas envolvidos: [ex: API de GPS, banco de dados de posição, serviço de notificação, app mobile]
- Dados sensíveis presentes? [Sim / Não - se Sim, descreva: ex: dados de localização de motoristas]
- Legislação aplicável: [ex: LGPD, GDPR, SOC2, nenhuma]
- Stakeholders de aprovação: [quem precisa aprovar antes do evento]
- Histórico de incidentes relevantes: [opcional - ex: houve falha de integração na última release]

---

## ANÁLISE SOLICITADA

Gere um checklist estruturado em três categorias:

### BLOQUEADORES
Itens que impedem o evento de acontecer se não estiverem OK.
- Máximo de 5 itens
- Cada item deve ter: **[categoria]** + descrição da verificação + critério de "passou"
- Categorias sugeridas: [Técnico] [Legal] [Segurança] [Operacional] [Aprovação]

### VERIFICAÇÕES OPERACIONAIS
Itens que devem ser verificados mas não bloqueiam - geram risco se ignorados.
- Máximo de 5 itens
- Mesmo formato: categoria + descrição + critério de verificação

### INFORMATIVOS
Itens de rastreabilidade e documentação que devem ser registrados.
- Máximo de 4 itens
- Não são checagens - são registros obrigatórios para auditoria

---

## RESTRIÇÕES DE COMPORTAMENTO

- O checklist deve ser específico para o contexto - não genérico. "Verificar se o sistema funciona" não é um item válido
- Cada item BLOQUEADOR deve ter um critério de "passou" objetivo e verificável (ex: "cobertura de testes > 80% confirmada no CI" - não "testes passando")
- Se houver dado sensível (LGPD/GDPR), inclua obrigatoriamente um BLOQUEADOR sobre consentimento e um INFORMATIVO sobre registro de tratamento
- Limite total: no máximo 14 itens (5 + 5 + 4) - qualquer coisa além vira ruído e prejudica adesão
- Se o contexto for insuficiente para gerar itens específicos, sinalize quais informações adicionais você precisaria
```

---

## Dados de Exemplo - Deploy em Produção: Módulo de Alertas de Velocidade - RouteWise

Use este input na demo para reproduzir o checklist do módulo:

```
Tipo de evento: Deploy em produção - primeira release

Contexto:
- Nome do projeto: RouteWise - Sistema de Gestão de Frota
- Funcionalidade: Módulo de Alertas de Velocidade em tempo real. Sistema monitora dados de GPS de 140 veículos e dispara notificações push para o app mobile do gestor quando um veículo ultrapassa 80 km/h
- Sistemas envolvidos: API de GPS (integração com rastreadores), banco de dados de posição, serviço de notificação push, aplicativo mobile do gestor, painel web de monitoramento
- Dados sensíveis: Sim - dados de localização em tempo real dos motoristas (dados pessoais de trabalhadores conforme LGPD)
- Legislação aplicável: LGPD (Lei 13.709/2018)
- Stakeholders de aprovação: Carlos (aprovação operacional), Marcus (aprovação técnica), Jurídico (dados pessoais de localização)
- Histórico de incidentes: bug crítico ativo (BUG-S4-10): guard de hardware bloqueia alertas para 43 dos 140 veículos com rastreador v1. Impacto parcial no escopo do deploy: 97 veículos receberão alertas na release inicial. Resolução depende de troca de hardware (cotação enviada, sem prazo de resposta do fornecedor)
```

**Output esperado na demo:**

> Output real gerado em 2026-07-10 (Gemini 3.1 Pro Preview, temperatura 0.3) — backup completo em `output-exemplo-compliance-m82.md`. Resumo: **13 itens (5 bloqueadores + 4 operacionais + 4 informativos)**.

### BLOQUEADORES (resumo)
1. **[Legal]** Base legal LGPD validada — aditivo, legítimo interesse ou termo de ciência dos motoristas; aprovação do Jurídico anexada à release.
2. **[Aprovação]** Sign-off de Carlos (Operacional) e Marcus (Técnico) registrado no ticket de gestão de mudança.
3. **[Técnico]** BUG-S4-10: tag "Monitoramento Indisponível (Hardware v1)" exibida no painel e no app para os 43 veículos — evita falso negativo de segurança.
4. **[Segurança]** Scan no CI/CD: apenas TLS 1.2+ no tráfego e criptografia em repouso no banco de posição.
5. **[Técnico]** Teste de carga: ingestão >80 km/h → push em menos de 3 segundos para os 97 veículos suportados.

### VERIFICAÇÕES OPERACIONAIS (resumo)
1. Comunicação de release: e-mail/pop-up informando cobertura de 97 veículos nesta fase.
2. Monitoramento de saúde: alerta se taxa de falha de push > 5% ou queda abrupta de ingestão de GPS.
3. Rollback: script de downgrade + feature flag no runbook para desligar o módulo instantaneamente.
4. Gestão de segredos: chaves e certificados push (APNs/FCM) via cofre de senhas, sem texto plano.

### INFORMATIVOS (resumo)
1. RoPA atualizado (Art. 37 LGPD) com nova finalidade e fluxo de retenção.
2. BUG-S4-10 nas Release Notes como Known Issue.
3. Hash do commit da main + tags das imagens Docker implantadas.
4. Número da cotação de hardware dos 43 veículos, vinculado ao épico.

---

## Notas de Design

**Por que separar em três categorias em vez de uma lista única:**
A distinção BLOQUEADOR / OPERACIONAL / INFORMATIVO cria hierarquia de urgência sem overhead de reunião. Um gestor olha os 5 bloqueadores primeiro - se todos estiverem verdes, o deploy está autorizado. As demais categorias não geram atrito no momento de decisão.

**Por que limitar a 14 itens:**
Checklists com mais de 15 itens têm taxa de conformidade próxima de zero em projetos de software - o time marca tudo como OK sem ler. 14 itens é o limite prático para revisão real antes de um deploy.

**Por que a LGPD aparece como bloqueador:**
Dados de localização de trabalhadores são dados pessoais sensíveis no contexto trabalhista. Um deploy em produção sem base legal documentada é um passivo jurídico imediato - não um risco futuro.

---

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
