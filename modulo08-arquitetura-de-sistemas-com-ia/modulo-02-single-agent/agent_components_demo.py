"""
Ahirton Lopes · AI Architecture Toolkit
Artefato de Demo - Módulo 2.1

Cinco mini-demonstrações, uma por peça da anatomia de um agente único
(Memória, Planejamento, Ferramentas, Ação, Approval Gate) — cada uma isolada
e rodável sozinha, sem o loop ReAct inteiro (isso é o Módulo 2.2) e sem o
schema formal de ferramenta (isso é o Módulo 2.4). O objetivo aqui é só
tornar cada peça tangível, uma de cada vez, antes de montá-las juntas nos
próximos vídeos do módulo.

Contexto: TrialForge, Agente ICF (gera a seção de assentimento do Termo de
Consentimento a partir do protocolo do estudo).

Versão em Python do mesmo exemplo de agent-components-demo.js (material de
referência — a versão oficial em JavaScript é a usada na gravação).

Requer (só a seção de Planejamento chama o modelo de verdade):
    1) Ollama instalado e rodando (ollama.com), com `ollama pull gemma4:e2b`
    2) pip install ollama
Uso: python agent_components_demo.py
"""

import time

from ollama import chat

MODELO = "gemma4:e2b"


# ============================================================
# 1. MEMÓRIA — curto prazo (efêmera) vs longo prazo (persistida)
# ============================================================

def memoria_curto_prazo(protocolo: str) -> list:
    # Vive só durante esta requisição: some quando a função termina, nunca é
    # reaproveitada pelo próximo protocolo que chegar.
    return [
        {"role": "system", "content": "Você redige seções de ICF para estudos clínicos."},
        {"role": "user", "content": f"Protocolo: {protocolo}"},
    ]


# Simula um "banco" simples só pra mostrar o princípio de memória persistida
# entre chamadas — em produção seria um banco de dados de verdade.
_banco_de_usuarios = {}


def memoria_longo_prazo(usuario_id: str, preferencia_nova: str = None) -> dict:
    historico = _banco_de_usuarios.get(usuario_id, {"interacoes": 0, "preferencias": []})
    historico["interacoes"] += 1
    if preferencia_nova:
        historico["preferencias"].append(preferencia_nova)
    _banco_de_usuarios[usuario_id] = historico
    return dict(historico)


def testar_memoria():
    print("== Testes: memória de longo prazo persiste entre chamadas ==")
    _banco_de_usuarios.clear()
    primeira = memoria_longo_prazo("usuario-teste", "prefere respostas curtas")
    segunda = memoria_longo_prazo("usuario-teste", "prefere tom formal")
    ok = segunda["interacoes"] == 2 and len(segunda["preferencias"]) == 2 and primeira["interacoes"] == 1
    print(f"  [{'OK' if ok else 'FALHOU'}] duas chamadas com o mesmo usuario_id acumulam estado")
    if not ok:
        raise AssertionError("memoria_longo_prazo não está persistindo corretamente entre chamadas")
    _banco_de_usuarios.clear()
    print()


def demonstrar_memoria():
    print("===== 1. MEMÓRIA =====")

    contexto = memoria_curto_prazo("Estudo fase II, público-alvo 12-17 anos, terapia oncológica experimental.")
    print(f"[Curto prazo] Contexto construído para esta requisição: {len(contexto)} mensagem(ns).")
    print("  -> O Agente ICF do TrialForge só precisa disso: cada protocolo é um caso novo,")
    print("     memória de longo prazo aqui seria custo sem benefício (canvas do Módulo 2.1).")
    print()

    print("[Longo prazo] Simulando um assistente diferente, que acompanha o mesmo usuário ao longo do tempo:")
    print("  1ª interação:", memoria_longo_prazo("usuario-42", "prefere respostas curtas"))
    print("  2ª interação:", memoria_longo_prazo("usuario-42", "prefere tom formal"))
    print("  -> Repare: a segunda chamada já sabe da primeira. Isso só vale a pena quando")
    print("     a tarefa se repete com o mesmo contexto ao longo do tempo — o oposto do ICF.")
    print()


# ============================================================
# 2. PLANEJAMENTO — chain-of-thought (quase de graça) vs reflexão (chamada a mais)
# ============================================================

def chain_of_thought(pergunta: str) -> dict:
    inicio = time.time()
    resposta = chat(
        model=MODELO,
        messages=[{"role": "user", "content": f"Pense passo a passo, de forma breve, antes de responder: {pergunta}"}],
    )
    return {"texto": resposta.message.content, "duracao_ms": int((time.time() - inicio) * 1000), "chamadas": 1}


def chain_of_thought_mais_reflexao(pergunta: str) -> dict:
    inicio = time.time()
    primeira = chat(model=MODELO, messages=[{"role": "user", "content": pergunta}])
    critica = chat(
        model=MODELO,
        messages=[
            {"role": "user", "content": pergunta},
            {"role": "assistant", "content": primeira.message.content},
            {
                "role": "user",
                "content": 'Releia sua resposta acima. Ela tem algum erro ou imprecisão? Responda só "sim" ou "não" e, se sim, qual.',
            },
        ],
    )
    return {"texto": critica.message.content, "duracao_ms": int((time.time() - inicio) * 1000), "chamadas": 2}


def demonstrar_planejamento():
    print("===== 2. PLANEJAMENTO =====")
    pergunta = (
        "Um estudo com público-alvo de 12 a 17 anos precisa de assentimento do participante, "
        "além do consentimento do responsável?"
    )

    cot = chain_of_thought(pergunta)
    print(f"[Chain-of-thought] {cot['chamadas']} chamada ao modelo, {cot['duracao_ms']}ms.")

    reflexao = chain_of_thought_mais_reflexao(pergunta)
    print(f"[+ Reflexão]        {reflexao['chamadas']} chamadas ao modelo, {reflexao['duracao_ms']}ms.")

    razao = reflexao["duracao_ms"] / cot["duracao_ms"]
    print(f"  -> Reflexão levou {razao:.1f}x mais tempo que chain-of-thought sozinho,")
    print("     porque é uma chamada inteira a mais, não só um raciocínio mais longo na mesma chamada.")
    print("     Essa é a distinção de custo que o canvas do Módulo 2.1 registra.")
    print()


# ============================================================
# 3. FERRAMENTAS — função determinística que o agente aciona
# ============================================================

# Versão mínima, só pra tornar tangível "ferramenta = função determinística
# que o agente delega". O schema formal (JSON, enum, validação de parâmetro)
# é o Módulo 2.4 — aqui é só a peça em isolamento.
def buscar_clausula_assentimento(faixa_etaria: list) -> dict:
    cobre_menor = any(idade < 18 for idade in faixa_etaria)
    if not cobre_menor:
        return {"texto": None, "aviso": "população adulta: cláusula de assentimento não se aplica"}
    return {
        "texto": (
            "Para participantes entre 12 e 17 anos, é necessário assentimento por escrito, além do "
            "consentimento do responsável legal (RDC ANVISA 466/2012, Art. 4º)."
        ),
        "fonte": "RDC ANVISA 466/2012, Art. 4º",
    }


def testar_ferramenta():
    print("== Testes: buscar_clausula_assentimento (determinístico) ==")
    menor = buscar_clausula_assentimento([12, 15, 17])
    adulto = buscar_clausula_assentimento([25, 40, 55])
    ok_menor = menor["texto"] is not None
    ok_adulto = adulto["texto"] is None
    print(f"  [{'OK' if ok_menor else 'FALHOU'}] faixa com menor de idade encontra cláusula")
    print(f"  [{'OK' if ok_adulto else 'FALHOU'}] faixa só de adultos não encontra cláusula")
    if not (ok_menor and ok_adulto):
        raise AssertionError("buscar_clausula_assentimento não está classificando corretamente")
    print()


def demonstrar_ferramentas():
    print("===== 3. FERRAMENTAS =====")
    print("[Caso 1] Estudo com participantes de 12 a 17 anos:")
    print("  ", buscar_clausula_assentimento([12, 15, 17]))
    print("[Caso 2] Estudo só com adultos:")
    print("  ", buscar_clausula_assentimento([25, 40, 55]))
    print('  -> O agente não "sabe" essa regra de cor: ele delega pra uma função')
    print("     determinística, porque é isso que sistemas determinísticos fazem melhor.")
    print()


# ============================================================
# 4 e 5. AÇÃO + APPROVAL GATE — nem toda ação executa direto
# ============================================================

def executar_ou_gatear(acao_proposta: dict) -> dict:
    if acao_proposta["requer_aprovacao"]:
        return {
            "status": "aguardando_aprovacao",
            "mensagem": (
                f'Ação "{acao_proposta["tipo"]}" NÃO executada. Aguardando Approval Gate '
                "(Módulo 1.3, Pergunta 2: erro caro e irreversível)."
            ),
        }
    return {"status": "executada", "resultado": acao_proposta["executar"]()}


def testar_gate():
    print("== Testes: executar_ou_gatear ==")
    sem_gate = executar_ou_gatear({"tipo": "x", "requer_aprovacao": False, "executar": lambda: "feito"})
    com_gate = executar_ou_gatear(
        {"tipo": "y", "requer_aprovacao": True, "executar": lambda: "nunca deveria rodar"}
    )
    ok_sem_gate = sem_gate["status"] == "executada" and sem_gate["resultado"] == "feito"
    ok_com_gate = com_gate["status"] == "aguardando_aprovacao" and "resultado" not in com_gate
    print(f"  [{'OK' if ok_sem_gate else 'FALHOU'}] ação sem gate executa direto")
    print(f"  [{'OK' if ok_com_gate else 'FALHOU'}] ação com gate nunca chega a executar")
    if not (ok_sem_gate and ok_com_gate):
        raise AssertionError("executar_ou_gatear não está bloqueando/liberando corretamente")
    print()


def demonstrar_acao_e_gate():
    print("===== 4 e 5. AÇÃO + APPROVAL GATE =====")

    gerar_rascunho = {
        "tipo": "gerar_rascunho_icf",
        "requer_aprovacao": False,  # rascunho não é a versão final, pode ser gerado direto
        "executar": lambda: "Rascunho da seção de assentimento gerado.",
    }
    print("[Ação 1: gerar rascunho]      ", executar_ou_gatear(gerar_rascunho))

    notificar_evento_adverso = {
        "tipo": "notificar_evento_adverso_regulatorio",
        "requer_aprovacao": True,  # escrita real + erro caro e irreversível (Módulo 2.4)
        "executar": lambda: "Notificação enviada à ANVISA.",  # nunca chega a rodar sozinha
    }
    print("[Ação 2: notificar evento adverso]", executar_ou_gatear(notificar_evento_adverso))

    print('  -> Mesma "capacidade de ação" nos dois casos. A diferença que decide se')
    print("     executa direto ou pausa pro Approval Gate não é técnica, é a Pergunta 2")
    print("     do Módulo 1.3: o erro é caro E irreversível?")
    print()


# ============================================================

def rodar_testes():
    testar_memoria()
    testar_ferramenta()
    testar_gate()


def main():
    rodar_testes()
    demonstrar_memoria()
    demonstrar_planejamento()
    demonstrar_ferramentas()
    demonstrar_acao_e_gate()


if __name__ == "__main__":
    main()


# Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
# Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
