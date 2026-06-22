---
marp: true
theme: uncover
class: invert
paginate: true
header: 'Nexus-Bot | Módulo 13.1'
footer: 'Instrutora: Camilla Martins (@PunkDoDevops)'
style: |
  section { background-color: #1a1a1a; }
  h1 { color: #00c6ff; }
  code { background: #2d2d2d; color: #00c6ff; }
---

# 🐳 Módulo 13.1: Dockerização
## Criando o Artefato de IA Imutável

---

### 🎯 Por que Docker no curso?

- **Ambiente Controlado:** Garantimos o uso do Python 3.12, evitando conflitos com versões locais (como o 3.14).
- **Zero Instalação Manual:** O aluno não precisa configurar `venv` ou instalar dependências no host.
- **Portabilidade:** O que roda no seu Mac agora, vai rodar no Kubernetes ou qualquer lugar.

---

### 🛠️ Estratégia de Build SRE

- **Base Image:** `python:3.12-slim` para menor superfície de ataque.
- **Segurança:** Uso do `.dockerignore` para não vazar o seu arquivo `.env` ou `venv`.
- **Configuração:** Ajuste do `PYTHONPATH` para que os módulos internos (`core`) sejam encontrados.

---

### 🚀 Ciclo de Vida Local

**1. Construção:**
`docker build -t nexus-bot:v1 .`

**2. Execução:**
`docker run --rm -e GROQ_API_KEY="sk-..." nexus-bot:v1`

---

# 💻 Mão na Massa!