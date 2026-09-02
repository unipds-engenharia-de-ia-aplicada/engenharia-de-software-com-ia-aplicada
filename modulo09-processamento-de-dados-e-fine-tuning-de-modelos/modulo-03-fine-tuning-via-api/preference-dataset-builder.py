"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 3.5 (adicao: Vertex AI Preference Tuning)

Constroi um dataset real de preferencia (chosen/rejected) pro job de
Preference Tuning (DPO) da Vertex AI, a partir dos mesmos 200 exemplos
reais ja usados no job de SFT do Modulo 3.2 (dataset-treinado.jsonl).

Para cada exemplo:
  - "chosen"  = a extracao correta ja usada no treino supervisionado (gabarito real)
  - "rejected" = uma extracao gerada de verdade agora, contra o mesmo documento,
                 mas com um prompt deliberadamente mais fraco (sem exigir JSON
                 estrito, sem exemplo no prompt) via um modelo local real (Ollama)
                 -- nao e um erro inventado, e uma resposta pior real, coerente
                 com o tipo de erro que motivou o Modulo 1 desta disciplina.

NOTA (registro de producao): utilitario one-shot de bastidor, nao e demo
em tela -- por isso nao tem par JavaScript (caso diferente do Modulo 5.4,
que tem alternativa JS documentada por ser demo em tela; aqui o script
nunca aparece rodando pra aluno nenhum, so o resultado ja congelado). Ja
foi executado em 19/08/2026: o preference-dataset-amplitude.jsonl desta
pasta e o artefato historico exato que alimentou o job real citado no
TP/Slide 8. NAO re-rodar sem motivo: a saida sobrescreveria esse
artefato com respostas "rejected" regeneradas nao-deterministicas
(temperature 0.7).

Uso (so em re-execucao deliberada): python3 preference-dataset-builder.py
Gera: preference-dataset-amplitude.jsonl (schema Vertex AI: contents/completions/score)
"""

import json
import urllib.request

ARQUIVO_ENTRADA = "dataset-treinado.jsonl"
ARQUIVO_SAIDA = "preference-dataset-amplitude.jsonl"
N_EXEMPLOS = 40  # subconjunto pequeno de demo, abaixo da faixa de producao (100-500)

OLLAMA_URL = "http://localhost:11434/api/generate"
MODELO_FRACO = "gemma4:e2b"

PROMPT_FRACO_TEMPLATE = """Leia o texto abaixo e me diga quem e o segurado, a placa e o valor.

{documento}"""


def carregar_exemplos_sft(caminho, n):
    exemplos = []
    with open(caminho, "r", encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if not linha:
                continue
            exemplos.append(json.loads(linha))
            if len(exemplos) >= n:
                break
    return exemplos


def extrair_documento_e_gabarito(exemplo_sft):
    texto_usuario = exemplo_sft["contents"][0]["parts"][0]["text"]
    # o texto do usuario e "instrucao\n\ndocumento" -- separa na primeira linha em branco
    partes = texto_usuario.split("\n\n", 1)
    documento = partes[1] if len(partes) > 1 else texto_usuario
    gabarito_texto = exemplo_sft["contents"][1]["parts"][0]["text"]
    return texto_usuario, documento, gabarito_texto


def chamar_ollama(prompt):
    payload = {
        "model": MODELO_FRACO,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.7},
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())["response"].strip()


def montar_linha_preferencia(texto_usuario, resposta_chosen, resposta_rejected):
    return {
        "contents": [{"role": "user", "parts": [{"text": texto_usuario}]}],
        "completions": [
            {"score": 1.0, "completion": {"role": "model", "parts": [{"text": resposta_chosen}]}},
            {"score": 0.0, "completion": {"role": "model", "parts": [{"text": resposta_rejected}]}},
        ],
    }


def main():
    print(f"Carregando os primeiros {N_EXEMPLOS} exemplos reais de {ARQUIVO_ENTRADA}...")
    exemplos_sft = carregar_exemplos_sft(ARQUIVO_ENTRADA, N_EXEMPLOS)
    print(f"{len(exemplos_sft)} exemplos carregados.\n")

    print(f"Gerando 'rejected' real via {MODELO_FRACO} (Ollama local, prompt fraco, sem cache)...\n")

    linhas_preferencia = []
    descartados = 0
    for i, exemplo in enumerate(exemplos_sft):
        texto_usuario, documento, chosen = extrair_documento_e_gabarito(exemplo)
        prompt_fraco = PROMPT_FRACO_TEMPLATE.format(documento=documento)
        rejected = chamar_ollama(prompt_fraco)

        if rejected.strip() == chosen.strip():
            # nao descarta silenciosamente: registra e pula, pra nao inserir
            # um par onde chosen e rejected sao identicos (nao ensina nada)
            descartados += 1
            print(f"  [{i}] descartado -- resposta fraca coincidiu com o gabarito")
            continue

        linha = montar_linha_preferencia(texto_usuario, chosen, rejected)
        linhas_preferencia.append(linha)
        print(f"  [{i}] chosen={chosen[:60]!r}...")
        print(f"       rejected={rejected[:60]!r}...")

    with open(ARQUIVO_SAIDA, "w", encoding="utf-8") as f:
        for linha in linhas_preferencia:
            f.write(json.dumps(linha, ensure_ascii=False) + "\n")

    print(f"\n{len(linhas_preferencia)} pares de preferência reais escritos em {ARQUIVO_SAIDA}")
    print(f"{descartados} descartado(s) por chosen == rejected.")


if __name__ == "__main__":
    main()

# Ahirton Lopes - Fine-Tuning Toolkit, UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
