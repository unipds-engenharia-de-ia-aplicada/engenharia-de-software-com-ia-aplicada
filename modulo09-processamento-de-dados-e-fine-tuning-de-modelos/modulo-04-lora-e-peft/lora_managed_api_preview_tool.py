"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Módulo 4.2 (referência espelhada em Python do .js oficial)

Companion de local_lora_training_tool.py. O MLX-LM não tem binding nativo
em Node -- o outro arquivo deste módulo monta um comando e dispara um
processo Python via subprocess/child_process, uma API do sistema
operacional, não uma API de ML. Este arquivo mostra o outro lado: como a
MESMA configuração de LoRA que treinamos localmente (rank 8, scale 20.0,
dropout 0.0 -- valores reais de mlx-adapters/adapter_config.json) fica
quando enviada de verdade, via requisição HTTP, pra uma API gerenciada que
expõe os parâmetros de LoRA no corpo da requisição: a API de fine-tuning da
Together AI (endpoint e formato de payload verificados contra a
documentação oficial em 2026-08-22, ver docs.together.ai).

Não é uma chamada simulada: monta a requisição HTTP real (URL, headers,
corpo) e só a envia de verdade se TOGETHER_API_KEY estiver configurada no
ambiente -- sem a chave, imprime a requisição que seria enviada e para aí,
sem fingir uma resposta que não existe.

Ressalva de honestidade: "scale" (MLX-LM) e "lora_alpha" (Together AI) não
são garantidamente definidos de forma idêntica entre frameworks -- os dois
controlam a magnitude do ajuste de baixo posto, mas a fórmula exata pode
variar. Este arquivo usa o mesmo valor numérico (20) como ponte
ilustrativa, não como equivalência matemática comprovada.

Uso: python3 lora_managed_api_preview_tool.py
"""

import json
import os
import urllib.error
import urllib.request

TOGETHER_ENDPOINT = "https://api.together.ai/v1/fine-tunes"

# ============================================================================
# 1. Configuração real reaproveitada do treino local (M4.2)
# ============================================================================

CONFIG_TREINADA_LOCAL = {"rank": 8, "dropout": 0.0, "scale": 20.0}


# ============================================================================
# 2. Montagem da requisição real (função pura, testável sem rede)
# ============================================================================


def montar_requisicao_lora_gerenciada(
    training_file_id,
    api_key=None,
    modelo="meta-llama/Meta-Llama-3.1-8B-Instruct-Reference",
    lora_config=None,
):
    if not training_file_id:
        raise ValueError("training_file_id é obrigatório (id do arquivo já enviado à API)")
    lora_config = lora_config or CONFIG_TREINADA_LOCAL
    return {
        "url": TOGETHER_ENDPOINT,
        "method": "POST",
        "headers": {
            "Authorization": f"Bearer {api_key or '<TOGETHER_API_KEY>'}",
            "Content-Type": "application/json",
        },
        "body": {
            "model": modelo,
            "training_file": training_file_id,
            "training_type": {
                "type": "Lora",
                "lora_r": lora_config["rank"],
                "lora_alpha": lora_config["scale"],
                "lora_dropout": lora_config["dropout"],
                "lora_trainable_modules": "all-linear",
            },
        },
    }


# ============================================================================
# 3. Envio real -- só dispara se TOGETHER_API_KEY existir no ambiente
# ============================================================================


def enviar_ou_prever(training_file_id):
    api_key = os.environ.get("TOGETHER_API_KEY")
    requisicao = montar_requisicao_lora_gerenciada(training_file_id, api_key=api_key)

    if not api_key:
        print("TOGETHER_API_KEY não configurada -- modo preview, nada foi enviado.")
        preview = dict(requisicao)
        preview["headers"] = {**requisicao["headers"], "Authorization": "Bearer <TOGETHER_API_KEY>"}
        print(json.dumps(preview, indent=2, ensure_ascii=False))
        return {"modo": "preview", "requisicao": requisicao}

    dados = json.dumps(requisicao["body"]).encode("utf-8")
    req = urllib.request.Request(requisicao["url"], data=dados, headers=requisicao["headers"], method="POST")
    try:
        with urllib.request.urlopen(req) as resposta:
            corpo = json.loads(resposta.read().decode("utf-8"))
    except urllib.error.HTTPError as erro:
        corpo_erro = erro.read().decode("utf-8")
        raise RuntimeError(f"Together AI recusou a requisição ({erro.code}): {corpo_erro}") from erro

    print("Job de fine-tuning LoRA criado de verdade:", corpo)
    return {"modo": "real", "requisicao": requisicao, "resposta": corpo}


# ----------------------------------------------------------------------------
# Testes automatizados
# ----------------------------------------------------------------------------

_total_testes = 0
_testes_com_falha = 0


def testar(descricao, fn):
    global _total_testes, _testes_com_falha
    _total_testes += 1
    try:
        fn()
        print(f"  [OK] {descricao}")
    except AssertionError as erro:
        _testes_com_falha += 1
        print(f"  [FALHOU] {descricao}")
        print(f"           {erro}")


def rodar_testes():
    print("== Testes: montagem da requisição LoRA gerenciada ==")

    def t1():
        req = montar_requisicao_lora_gerenciada("file-abc123")
        assert req["url"] == "https://api.together.ai/v1/fine-tunes"
        assert req["method"] == "POST"

    testar("usa o endpoint real de fine-tuning da Together AI", t1)

    def t2():
        try:
            montar_requisicao_lora_gerenciada(None)
            raise AssertionError("deveria ter lançado ValueError")
        except ValueError as erro:
            assert "training_file_id" in str(erro)

    testar("exige training_file_id", t2)

    def t3():
        req = montar_requisicao_lora_gerenciada("file-abc123")
        tt = req["body"]["training_type"]
        assert tt["lora_r"] == 8
        assert tt["lora_alpha"] == 20.0
        assert tt["lora_dropout"] == 0.0

    testar("reaproveita rank 8 / scale 20.0 / dropout 0.0 do treino real de M4.2", t3)

    def t4():
        req = montar_requisicao_lora_gerenciada("file-abc123")
        assert req["body"]["training_type"]["type"] == "Lora"
        assert "training_file" in req["body"]
        assert "model" in req["body"]

    testar('corpo da requisição usa o formato training_type.type = "Lora" documentado', t4)

    def t5():
        req = montar_requisicao_lora_gerenciada("file-abc123")
        assert req["headers"]["Authorization"] == "Bearer <TOGETHER_API_KEY>"

    testar("sem api_key, o header Authorization usa placeholder (nunca string vazia)", t5)

    def t6():
        req = montar_requisicao_lora_gerenciada("file-abc123", api_key="sk-real-123")
        assert req["headers"]["Authorization"] == "Bearer sk-real-123"

    testar("com api_key, o header Authorization carrega a chave de verdade", t6)

    print(f"\n{_total_testes - _testes_com_falha}/{_total_testes} testes passaram.")
    return _testes_com_falha == 0


if __name__ == "__main__":
    ok = rodar_testes()
    enviar_ou_prever("file-exemplo-amplitude-seguros")
    if not ok:
        raise SystemExit(1)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
