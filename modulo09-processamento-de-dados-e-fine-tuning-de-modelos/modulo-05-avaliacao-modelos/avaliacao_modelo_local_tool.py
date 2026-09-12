"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 5.4

Fecha uma promessa em aberto desde o Modulo 4.4: "o Modulo 5 ensina como
avaliar direito... contra os dois modelos reais que esta disciplina ja
treinou, o do Vertex AI e o local de hoje". Os Modulos 5.1-5.3 avaliaram
so o modelo do Vertex AI. Este arquivo roda o MESMO conjunto de teste
retido do Modulo 5.1 (gerar_conjunto_teste_retido, sem duplicar logica)
contra o modelo local, LoRA rank 8 (modulo-04-lora-e-peft/mlx-adapters),
usando as MESMAS funcoes de adequacao de schema e precisao por campo do
harness do Modulo 5.1, mesma vara de medir, segundo modelo.

A API Python `mlx_lm.generate` usada aqui carrega o modelo uma vez e roda
as 11 avaliacoes no mesmo processo. Alternativa em JavaScript pra quem
preferir esse caminho: avaliacao-modelo-local-tool.js (nesta pasta) roda
a MESMA avaliacao via CLI/subprocesso (mesmo padrao dos Modulos 4.2-4.4),
recarregando o modelo inteiro a cada chamada -- a diferenca de custo
entre os dois caminhos fica documentada e demonstrada la.

Uso: python3 avaliacao_modelo_local_tool.py
"""

import importlib.util
import os
import sys
from pathlib import Path

_M5_1_PATH = Path(__file__).parent / "model_evaluation_harness_tool.py"
_spec = importlib.util.spec_from_file_location("model_evaluation_harness_tool", _M5_1_PATH)
harness = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(harness)

MODELO_BASE = "mlx-community/gemma-4-e2b-it-bf16"
ADAPTADOR = Path(__file__).parent.parent / "modulo-04-lora-e-peft" / "mlx-adapters"  # LoRA rank 8


def montar_prompt(tokenizer, exemplo):
    texto_usuario = f"{exemplo['instrucao']}\n\n{exemplo['entrada']}"
    mensagens = [{"role": "user", "content": texto_usuario}]
    return tokenizer.apply_chat_template(mensagens, add_generation_prompt=True, tokenize=False)


# ---------------------------------------------------------------------------
# Testes automatizados (sem carregar o modelo -- só a forma do conjunto)
# ---------------------------------------------------------------------------

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
    print("== Testes: reuso do conjunto de teste retido do Módulo 5.1 ==")

    def t1():
        conjunto = harness.gerar_conjunto_teste_retido()
        assert len(conjunto) == 11

    testar("o mesmo conjunto retido do Módulo 5.1 (11 exemplos) está disponível pra reuso", t1)

    def t2():
        assert ADAPTADOR.exists(), f"adaptador não encontrado em {ADAPTADOR}"

    testar("adaptador LoRA rank 8 do Módulo 4.2 existe em disco", t2)

    print()
    print(
        f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
        f"{_testes_com_falha} falhou(falharam)."
    )
    if _testes_com_falha > 0:
        raise SystemExit(f"{_testes_com_falha} teste(s) falharam. A implementação não bate com a especificação.")


# ---------------------------------------------------------------------------
# Execução principal -- carrega o modelo local de verdade e roda o conjunto
# ---------------------------------------------------------------------------


def main():
    rodar_testes()

    from mlx_lm import load, generate

    print()
    print(f"== Carregando modelo local: {MODELO_BASE} + adaptador LoRA rank 8 ==")
    model, tokenizer = load(MODELO_BASE, adapter_path=str(ADAPTADOR))

    print()
    print("== Avaliação real: modelo local (MLX, Módulo 4.2) contra o conjunto retido do Módulo 5.1 ==")
    conjunto_teste = harness.gerar_conjunto_teste_retido()
    print(f"{len(conjunto_teste)} exemplos, os mesmos usados pra avaliar o modelo do Vertex AI, nunca vistos no treino.\n")

    soma_precisao = 0
    schemas_validos = 0
    sucessos = 0
    falhas = []

    for exemplo in conjunto_teste:
        try:
            prompt = montar_prompt(tokenizer, exemplo)
            texto_resposta = generate(model, tokenizer, prompt=prompt, max_tokens=150, verbose=False)
        except Exception as erro:
            print(f"{exemplo['metadata']['id']}: [FALHOU] {erro}")
            falhas.append({"id": exemplo["metadata"]["id"], "erro": str(erro)})
            continue
        schema = harness.avaliar_adequacao_schema(exemplo["metadata"]["caso"], texto_resposta)
        if schema["valido"]:
            precisao = harness.avaliar_precisao_por_campo(exemplo["saida"], schema["campos"])
        else:
            precisao = {"precisao": 0, "acertos": 0, "total": len(exemplo["saida"])}

        if schema["valido"]:
            schemas_validos += 1
        soma_precisao += precisao["precisao"]
        sucessos += 1

        print(
            f"{exemplo['metadata']['id']}: schema {'válido' if schema['valido'] else 'INVÁLIDO'}, "
            f"precisão {precisao['precisao'] * 100:.0f}% ({precisao['acertos']}/{precisao['total']})"
        )

    if falhas:
        print(f"\n{len(falhas)}/{len(conjunto_teste)} exemplo(s) falharam na geração local -- verifique o modelo/adaptador.")
    if sucessos == 0:
        raise RuntimeError("Nenhum exemplo processado com sucesso -- verifique o modelo/adaptador local.")

    print(f"\nAdequação de schema: {schemas_validos}/{sucessos}")
    print(f"Precisão média por campo: {soma_precisao / sucessos * 100:.1f}%")
    print()
    print("-----------------------------------------------------------------------------")
    print("Mesmo conjunto de teste retido, mesma vara de medir do Módulo 5.1, só o modelo")
    print("mudou, do endpoint do Vertex AI pro checkpoint LoRA local deste computador. A")
    print("robustez medida nos Módulos 5.1-5.3 não era sorte de um provedor só.")
    print("-----------------------------------------------------------------------------")


if __name__ == "__main__":
    try:
        main()
    except Exception as erro:
        print(f"\nErro: {erro}")
        print("Verifique se o MLX-LM está instalado e se o modelo/adaptador estão acessíveis, e tente de novo.")
        if os.environ.get("DEBUG"):
            raise
        sys.exit(1)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
