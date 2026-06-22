---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0a0e14
color: #e6edf3
style: |
  section { text-align: left; font-size: 20px; }
  h1 { color: #00ff88; font-size: 38px; border-bottom: 2px solid #00ff88; }
  h2 { color: #00d4ff; font-size: 28px; }
  code { background-color: #1a1f29; color: #ffca28; }
  b { color: #00ff88; }

---

# Módulo 2: IaC Copilot & Security Governance
## Geração, Auditoria e Self-Healing com IA
**Professora:** Camilla Martins
**Aulas:** 2.1 a 2.3

---

# Aula 2.1: De Requisitos a HCL
### O Agente como Tradutor de Negócio

- **Tradução Semântica:** Como a IA converte "Ambiente de Produção de Logs" em blocos `resource "aws_s3_bucket"`.
- **Persistência via `writer_tool`:** - A diferença entre gerar texto e manipular o FileSystem.
  - O uso do Python como ponte para criar o arquivo `main.tf` fisicamente.



---

# Aula 2.2: Compliance-as-Code com Checkov
### Segurança Técnica via Análise Estática (SCA)

- **Scanner Real:** Integração via `subprocess` com o binário do **Checkov**.
- **O que validamos?**
  - Criptografia em repouso (SSE).
  - Bloqueio de acesso público (Public Access Block).
  - Versionamento de recursos críticos.
- **Feedback Loop:** Se o Checkov reprova, a IA lê o log de erro e refatora o código automaticamente até passar.

---

# Aula 2.3: OPA e Lógica de Negócio
### Governança Além da Segurança Técnica

- **OPA (Open Policy Agent):** Validação de regras que scanners genéricos não conhecem.
- **Exemplos de Regras Nexus (Rego):**
  - Soberania de Dados: "Recursos apenas em us-east-1".
  - Controle de Custo: "Proibido instâncias maiores que t3.medium".
- **Drift Detection:** O papel da IA em identificar quando o console da Cloud diverge do código.



---

# Prática: O Pipeline de Automação
### Anatomia do Script Advanced

1. **Arquiteto:** Gera o arquivo HCL inicial.
2. **Auditor (Checkov):** Roda o scan real. Se falhar, devolve para o Arquiteto.
3. **Auditor (OPA):** Valida se o projeto respeita o orçamento e a região da empresa.
4. **Finalização:** O arquivo `main.tf` é entregue pronto para o `terraform apply`.

```bash
# Executando o Módulo 2
python3 labs/modulo2_iac_copilot.py