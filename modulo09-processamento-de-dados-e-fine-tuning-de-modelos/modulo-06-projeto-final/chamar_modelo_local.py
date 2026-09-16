"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 6.2

Companheiro Python do amplitude-seguros-assistente.js: expoe o checkpoint
local, LoRA rank 8 do Modulo 4.2, como um processo de linha de comando que
recebe {instrucao, entrada} via stdin (JSON) e devolve o texto bruto da
resposta do modelo via stdout -- mesmo contrato de retorno que
chamarModeloReal do Modulo 5.1 (uma string com o texto da resposta), pra o
orquestrador em JavaScript tratar os dois caminhos, nuvem e local, de forma
uniforme.

So em Python: mlx-lm roda em Apple Silicon e nao tem par em JavaScript,
mesma excecao que o Modulo 5.4 ja estabeleceu.

Uso: echo '{"instrucao": "...", "entrada": "..."}' | python3 chamar_modelo_local.py
"""

import json
import sys
from pathlib import Path

MODELO_BASE = "mlx-community/gemma-4-e2b-it-bf16"
ADAPTADOR = Path(__file__).parent.parent / "modulo-04-lora-e-peft" / "mlx-adapters"  # LoRA rank 8

_modelo_cache = None


def carregar_modelo():
    global _modelo_cache
    if _modelo_cache is None:
        from mlx_lm import load
        _modelo_cache = load(MODELO_BASE, adapter_path=str(ADAPTADOR))
    return _modelo_cache


def chamar_modelo_local(instrucao, entrada):
    from mlx_lm import generate
    model, tokenizer = carregar_modelo()
    texto_usuario = f"{instrucao}\n\n{entrada}"
    mensagens = [{"role": "user", "content": texto_usuario}]
    prompt = tokenizer.apply_chat_template(mensagens, add_generation_prompt=True, tokenize=False)
    return generate(model, tokenizer, prompt=prompt, max_tokens=150, verbose=False)


def main():
    entrada_bruta = sys.stdin.read()
    dados = json.loads(entrada_bruta)
    resposta = chamar_modelo_local(dados["instrucao"], dados["entrada"])
    print(resposta)


if __name__ == "__main__":
    main()

"""
Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
"""
