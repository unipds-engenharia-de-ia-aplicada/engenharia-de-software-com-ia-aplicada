# Usando o Requirements Copilot em outras plataformas
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 1.1**

> **Artefato de Demo - Módulo 1.1**
> Guia de adaptação do Requirements Copilot para plataformas além do AI Studio.


As demos do curso usam o **Google AI Studio (Gemini)**. Os prompts funcionam em qualquer modelo com suporte a system prompt e contexto de ~8.000 tokens — sem ajuste no conteúdo.

## Como configurar por plataforma

**Claude (claude.ai)**
Abra um projeto → cole o prompt em "Project Instructions". Claude tende a ser mais conservador em inferências, o que é uma vantagem para requisitos. Se o output vier incompleto em alguma seção, adicione ao final do prompt: *"Quando a informação não estiver explícita, sinalize com [AMBIGUIDADE] e declare a suposição."*
Modelo recomendado: Sonnet (custo/qualidade) ou Opus (máxima qualidade).

**ChatGPT / GPT-4 (OpenAI)**
ChatGPT Plus: crie um GPT personalizado com o prompt no campo de instruções. GPT-4 tem maior viés de completude — reforce: *"Nunca invente especificações. Use [AMBIGUIDADE] obrigatoriamente."*
Temperatura recomendada: 0.3–0.5.

**Azure OpenAI / GitHub Copilot**
Mesma API do OpenAI, mesmas instruções. Vantagem: dados não saem da sua tenant Azure — relevante para clientes com restrições de compliance.

**Modelos locais (Ollama)**
Llama 3.1 70B funciona bem. Modelos menores (7B–13B) tendem a ignorar seções inteiras do prompt — não recomendados para INVEST e Gherkin. Use modelos locais quando o projeto tiver restrição contratual de não enviar dados a APIs externas.

```bash
# Ollama - Modelfile
FROM llama3.1:70b
SYSTEM """
[cole aqui o conteúdo do requirements-copilot-system-prompt.md]
"""
```

## Se o output de qualquer modelo vier incompleto

Adicione esta linha no final do prompt:

> *"Siga rigorosamente o formato de output. Não omita seções. Se uma seção não puder ser preenchida, escreva [INFORMAÇÃO INSUFICIENTE] e explique em uma linha o que falta."*

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*
