---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0d1117
color: #e6edf3
style: |
  section { text-align: left; font-size: 22px; }
  h1 { color: #58a6ff; font-size: 40px; border-bottom: 2px solid #30363d; padding-bottom: 10px; }
  h2 { color: #79c0ff; font-size: 30px; }
  code { background-color: #161b22; color: #ff7b72; border-radius: 4px; }
  b { color: #d2a8ff; }
  footer { font-size: 15px; color: #8b949e; }

---

# Módulo 1: Fundamentos de IA para DevOps
## Da Automação à Inteligência Agêntica
**Instrutora:** Camilla Martins
**Aulas:** 1.1 a 1.3

---

# Aula 1.1: LLMs e APIs no Contexto DevOps
### Por que a IA entende código?

- **Arquitetura de Transformers:** Baseada em *Self-Attention*. Permite ao modelo capturar relações de longa distância em arquivos HCL ou YAML.
- **Tokenização Técnica:** Como a IA interpreta blocos de código em vez de apenas palavras.
- **Comparativo de Engines (O Estado da Arte):**
  - **OpenAI (GPT-4o):** Versatilidade e raciocínio lógico superior.
  - **Anthropic (Claude 3.5 Sonnet):** O favorito dos desenvolvedores por gerar sintaxes de código mais limpas.
  - **AWS Bedrock:** Governança e segurança para rodar modelos em escala enterprise.



---

# Aula 1.2: Frameworks de Agentes
### Orquestrando Complexidade com CrewAI e LangChain

- **O que é um Agente?** É uma LLM com **Autonomia**, **Papel Definido** e **Ferramentas**.
- **CrewAI vs Scripts Simples:**
  - **Sistemas Multi-Agente:** Permite delegar tarefas (ex: Arquiteto -> Auditor).
  - **Processos:** Sequencial (CI/CD) ou Hierárquico.
- **Memória e Contexto:** Como os agentes mantêm o estado da infraestrutura durante a execução.

---

# Aula 1.3: RAG e Prompting Avançado
### Eliminando Alucinações em Sistemas Críticos

- **RAG (Retrieval-Augmented Generation):** - Conecta a IA a fontes externas (Docs da AWS, Kubernetes, Políticas Internas).
  - A IA não "adivinha"; ela **consulta** e depois **gera**.
- **Técnicas de Engenharia de Prompt:**
  - **Chain-of-Thought (CoT):** Obriga a IA a descrever o plano antes de executar comandos CLI.
  - **Few-Shot Prompting:** Envio de exemplos (Padrão Nexus) para garantir conformidade.



---

# Laboratório: Nexus Foundation
### Colocando em Prática

No nosso laboratório, implementamos:
1. **Engine:** Conexão via LiteLLM para modelos de alta performance (Llama 3.3).
2. **RAG Funcional:** Tool de consulta de normas de SRE.
3. **Workflow:** Arquiteto projeta e DevSecOps valida.

```bash
# Execução do script fundação e avaliar o padrão que a IA retorna para nossa infra
python3 labs/modulo1_foundation.py
```