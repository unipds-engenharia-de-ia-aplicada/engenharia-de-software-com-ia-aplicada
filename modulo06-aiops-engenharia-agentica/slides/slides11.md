---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0a0e14
color: #e6edf3

---
# Módulo 11: Guardrails e Governança
## Automação com Segurança
**Professora:** Camilla Martins

---
# O Risco da IA Autônoma
- A IA pode "alucinar" comandos destrutivos.
- Viés de Confirmação: A IA quer resolver o problema a qualquer custo, mesmo que isso cause um incidente pior.
- **Solução:** Implementar travas de segurança lógicas.

---
# Human-in-the-Loop (HITL)
- A IA diagnostica e propõe.
- O humano valida e autoriza.
- **Regra de Ouro:** Nenhuma ação de escrita (`kubectl apply`, `terraform apply`) sem aprovação explícita.

---
# Estratégia de Defesa: Dry-Run
- Utilizar a flag `--dry-run` para prever o impacto.
- Validar sintaxe antes da execução real.
- **Log de Auditoria:** Registrar o que a IA tentou fazer e o que o humano aprovou.

**"Inteligência não substitui o juízo crítico do engenheiro."**

```
python3 labs/modulo11_guardrails.py --dry-run
```

---