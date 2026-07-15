# Output Compliance Checklist - U8.2 Backup
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 8.2**
> Output de referência gerado em pré-gravação. Use como backup caso o modelo produza resultado inesperado na demo ao vivo.

Gerado em: 2026-07-10 (AI Studio - Gemini 3.1 Pro Preview)
Input: Deploy em produção (primeira release) - Módulo Alertas de Velocidade RouteWise + BUG-S4-10
Temperatura: 0.3

---

Aqui está o checklist de conformidade e governança estruturado especificamente para a primeira release em produção do módulo de alertas do **RouteWise**, considerando as restrições técnicas, legais e o incidente de hardware ativo.

### 🛑 BLOQUEADORES (Go/No-Go)
*Itens impeditivos. O deploy não pode ocorrer se qualquer um destes critérios falhar.*

1. **[Legal]** Validação de base legal e ciência dos motoristas sobre o monitoramento de velocidade e localização em tempo real (LGPD).
   * **Critério de "passou":** Aprovação formal (via ticket ou e-mail) do departamento Jurídico anexada à release, confirmando a existência de aditivo contratual, legítimo interesse documentado ou termo de ciência assinado pelos trabalhadores.
2. **[Aprovação]** Sign-off das lideranças técnica e operacional para a primeira release.
   * **Critério de "passou":** Aprovações de Carlos (Operacional) e Marcus (Técnico) registradas e auditáveis no ticket de gestão de mudança (Change Request) do deploy.
3. **[Técnico]** Tratamento sistêmico da exceção de hardware (BUG-S4-10) para evitar falsos negativos de segurança.
   * **Critério de "passou":** O painel web de monitoramento e o app do gestor exibem explicitamente a tag "Monitoramento Indisponível (Hardware v1)" para os 43 veículos afetados, impedindo que o gestor assuma erroneamente que eles estão dentro do limite de velocidade.
4. **[Segurança]** Proteção do tráfego de dados de geolocalização entre a API de GPS, o banco de dados e o serviço de push.
   * **Critério de "passou":** Scan de segurança no pipeline de CI/CD confirmando que não há tráfego HTTP puro (apenas TLS 1.2+) e que a criptografia em repouso está habilitada no banco de dados de posição.
5. **[Técnico]** Validação de latência do gatilho de velocidade (80 km/h) para os 97 veículos suportados.
   * **Critério de "passou":** Relatório de teste de carga/integração no ambiente de staging comprovando que o tempo entre a ingestão do dado de GPS (>80 km/h) e o disparo do payload para o serviço de notificação push é inferior a 3 segundos.

---

### ⚠️ VERIFICAÇÕES OPERACIONAIS
*Itens que não bloqueiam o deploy, mas geram risco operacional ou de comunicação se ignorados.*

1. **[Operacional]** Plano de comunicação de release para os gestores de frota.
   * **Critério de verificação:** E-mail de lançamento ou pop-up no app mobile configurado para informar claramente que a funcionalidade está ativa apenas para 97 veículos nesta primeira fase, alinhando expectativas.
2. **[Técnico]** Monitoramento de saúde da integração com a API de GPS e serviço de Push.
   * **Critério de verificação:** Alertas configurados na ferramenta de observabilidade (ex: Datadog, Grafana) para disparar se a taxa de falha na entrega de notificações push passar de 5% ou se a ingestão de GPS cair abruptamente.
3. **[Técnico]** Plano de reversão (Rollback) validado para o banco de dados e serviços.
   * **Critério de verificação:** Existência de script de downgrade para o banco de dados de posição e feature flag documentada no runbook para desligar o módulo de alertas instantaneamente em caso de falha crítica.
4. **[Segurança]** Gestão de segredos do serviço de notificação push e API de GPS.
   * **Critério de verificação:** Confirmação de que as chaves de produção da API e certificados de push (APNs/FCM) estão injetados via cofre de senhas (ex: AWS Secrets Manager) e não expostos em variáveis de ambiente de texto plano.

---

### ℹ️ INFORMATIVOS
*Registros obrigatórios para fins de auditoria, rastreabilidade e compliance.*

1. **[Registro LGPD]** Atualização do Registro de Operações de Tratamento de Dados Pessoais (RoPA - Art. 37 da LGPD) documentando a nova finalidade de coleta de dados (alertas de velocidade em tempo real) e o fluxo de retenção no banco de dados de posição.
2. **[Rastreabilidade]** Inclusão do ticket **BUG-S4-10** nas *Release Notes* públicas/internas sob a seção de "Problemas Conhecidos (Known Issues)", detalhando a incompatibilidade com os rastreadores v1.
3. **[Auditoria]** Registro do hash do commit da branch `main` e das tags das imagens Docker (API de GPS, Serviço de Push, Painel Web) efetivamente implantadas no ambiente de produção.
4. **[Operacional]** Registro do número da cotação/chamado de compras pendente referente à troca de hardware dos 43 veículos afetados, vinculado ao épico do projeto para acompanhamento de resolução pós-deploy.

---

*Total: 13 itens (5 bloqueadores + 4 operacionais + 4 informativos) — abaixo do teto de 14 do prompt.*

*Artefato de referência para gravação — usar este arquivo em tela durante a demo.*
*Input: deploy em produção (primeira release), Alertas de Velocidade, 140 veículos (97 ativos, 43 com BUG-S4-10), LGPD, Carlos + Marcus + Jurídico.*

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
