"""
Ahirton Lopes · AI Architecture Toolkit
Artefato de Demo - Módulo 2.5

Três alternativas PAGAS ao Ollama local de react_agent_prototype.py: Claude
(Anthropic), Gemini (Google) e GPT (OpenAI). A lição do diagrama de referência
do Módulo 1.2 vale aqui: o modelo é a peça que se troca — o loop ReAct, a
ferramenta e o critério de parada de agente_icf() não mudam em nenhuma das três.

Repare também que cada provedor declara o schema da MESMA ferramenta num
formato ligeiramente diferente: Claude e Gemini usam a mesma forma achatada
(name/description soltos na raiz do schema), o GPT usa uma forma aninhada,
dentro de function: {...}. É exatamente esse tipo de fragmentação que um
protocolo padronizado como o MCP, do Módulo 2.4, existe para resolver.

Estas três funções não substituem o Ollama por padrão — são referência para
quando você quiser trocar de provedor no seu próprio protótipo da Missão Prática.

Requer: a SDK paga do provedor que você for usar, instalada separadamente
        (ver o comentário de instalação em cada seção abaixo) e a respectiva
        chave de API configurada no ambiente (ANTHROPIC_API_KEY, GEMINI_API_KEY
        ou OPENAI_API_KEY).
Aviso:  este arquivo não roda sozinho, só exporta as três funções para você
        importar dentro do seu próprio protótipo. Rodar `python3 provedores_pagos.py`
        direto quebra com erro de módulo não instalado, porque nenhum desses SDKs
        pagos faz parte da instalação padrão do curso (só o Ollama vem pronto).
"""

import json

# ---------- 1. Claude (Anthropic) — pip install anthropic ----------
import anthropic

claude = anthropic.Anthropic()  # lê ANTHROPIC_API_KEY do ambiente

TOOL_CLAUDE = {
    "name": "buscar_clausula_regulatoria",
    "description": (
        "Busca cláusulas regulatórias de estudos clínicos por tema e jurisdição. "
        "Use quando precisar de texto normativo (ANVISA ou FDA) para compor uma seção do documento."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "tema": {"type": "string"},
            "jurisdicao": {"type": "string", "enum": ["ANVISA", "FDA"]},
        },
        "required": ["tema", "jurisdicao"],
    },
}


def chamar_claude(historico: list) -> dict:
    resposta = claude.messages.create(
        model="claude-sonnet-5",
        max_tokens=1024,
        tools=[TOOL_CLAUDE],
        messages=historico,
    )
    chamada = next((bloco for bloco in resposta.content if bloco.type == "tool_use"), None)
    if chamada:
        return {"tipo": "chamada_ferramenta", "nome": chamada.name, "args": chamada.input}
    return {"tipo": "resposta_final", "texto": resposta.content[0].text}


# ---------- 2. Gemini (Google) — pip install google-genai ----------
from google import genai

gemini = genai.Client()  # lê GEMINI_API_KEY do ambiente

TOOL_GEMINI = {
    "type": "function",
    "name": "buscar_clausula_regulatoria",
    "description": (
        "Busca cláusulas regulatórias de estudos clínicos por tema e jurisdição. "
        "Use quando precisar de texto normativo (ANVISA ou FDA) para compor uma seção do documento."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "tema": {"type": "string"},
            "jurisdicao": {"type": "string", "enum": ["ANVISA", "FDA"]},
        },
        "required": ["tema", "jurisdicao"],
    },
}


# Nota de assinatura: chamar_claude/chamar_gpt recebem "historico" (o mesmo array de
# mensagens usado no loop ReAct); esta função recebe só "protocolo" (string) porque a
# API de Interactions do Gemini gerencia o histórico de conversa do lado do servidor,
# não como um array de mensagens que o chamador monta e reenvia a cada turno — é uma
# diferença real de formato entre provedores, não um descuido. Ao adaptar este sketch
# pro seu próprio protótipo, ajuste o chamador de acordo (não assuma as 3 funções
# intercambiáveis por assinatura, só por papel na arquitetura).
def chamar_gemini(protocolo: str) -> dict:
    interacao = gemini.interactions.create(
        model="gemini-3.5-flash",
        input=protocolo,
        tools=[TOOL_GEMINI],
    )
    chamada = next((passo for passo in interacao.steps if passo.type == "function_call"), None)
    if chamada:
        return {"tipo": "chamada_ferramenta", "nome": chamada.name, "args": chamada.arguments}
    return {"tipo": "resposta_final", "texto": interacao.output_text}


# ---------- 3. GPT (OpenAI) — pip install openai ----------
import openai

gpt = openai.OpenAI()  # lê OPENAI_API_KEY do ambiente

TOOL_GPT = {
    "type": "function",
    "function": {
        "name": "buscar_clausula_regulatoria",
        "description": (
            "Busca cláusulas regulatórias de estudos clínicos por tema e jurisdição. "
            "Use quando precisar de texto normativo (ANVISA ou FDA) para compor uma seção do documento."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "tema": {"type": "string"},
                "jurisdicao": {"type": "string", "enum": ["ANVISA", "FDA"]},
            },
            "required": ["tema", "jurisdicao"],
        },
    },
}


def chamar_gpt(historico: list) -> dict:
    resposta = gpt.chat.completions.create(
        model="gpt-5.6",
        messages=historico,
        tools=[TOOL_GPT],
    )
    tool_calls = resposta.choices[0].message.tool_calls
    if tool_calls:
        chamada = tool_calls[0]
        return {
            "tipo": "chamada_ferramenta",
            "nome": chamada.function.name,
            "args": json.loads(chamada.function.arguments),
        }
    return {"tipo": "resposta_final", "texto": resposta.choices[0].message.content}

# Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
# Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
