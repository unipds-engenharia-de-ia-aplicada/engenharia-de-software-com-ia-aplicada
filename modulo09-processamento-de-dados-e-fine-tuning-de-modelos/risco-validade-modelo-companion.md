# Companion: Risco de Validade de Modelo

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Guia operacional, disciplina inteira**

## Por que isso existe

Esta disciplina usa modelo real em todo lugar, não estimativa nem exemplo genérico. Isso é o que dá credibilidade aos números - mas modelo real muda de disponibilidade com o tempo, exemplo genérico nunca muda. Este companion existe pra separar as duas coisas que ficam junto na cabeça: **o processo que a disciplina ensina nunca muda; o nome exato do modelo, sim.**

Duas famílias de modelo aparecem aqui, com risco de validade bem diferente uma da outra.

---

## 1. Gemini / Vertex AI - modelo gerenciado, pode ser desligado

`gemini-2.5-flash` é o modelo usado em toda a metade "nuvem" da disciplina. A Google aposenta versões do Gemini com aviso prévio - a família 2.5 tem **retirement anunciado pra 16/out/2026**. Quando isso acontece, a versão para de responder chamada de API, ponto final. Diferente de peso baixado, não tem como "continuar rodando a versão antiga por conta própria".

**Onde isso aparece nesta disciplina** (todo ponto que cita ou chama `gemini-2.5-flash` de verdade):

| Módulo | Arquivo |
|---|---|
| M2.1 | `modulo-02-preparacao-datasets/extracao-llm-multimodal-tool.js` / `.py` |
| M3.4 | `modulo-03-fine-tuning-via-api/finetuning-automation-tool.js` / `.py`, `dolly-vertex-pipeline.js` / `.py`, `model-card-dolly-extra-200.md` |
| M3.5 | `modulo-03-fine-tuning-via-api/model-versioning-tool.js` / `.py`, `model-card-amplitude-auto-saude-m3-200.md` |

**Lista vigente no momento da gravação (ago/2026):** `gemini-2.5-pro` / `gemini-2.5-flash` / `gemini-2.5-flash-lite` (GA - suporte oficial completo), `gemini-3.1-flash-lite` / `gemini-3.5-flash` (Preview, regiões `us-central1`/`europe-west4` - a disciplina já usa `us-central1`).

**Link de checagem, sempre atualizado pela própria Google:**
[docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes)

---

## 2. Gemma - peso aberto, baixado uma vez, nunca desliga (mas fica pra trás)

`Gemma 4 E2B` é o modelo usado em toda a metade "local" da disciplina, em três formas de entrega do mesmo modelo-base:

- `mlx-community/gemma-4-e2b-it-bf16` - MLX, Apple Silicon (M4.2-4.4, M5.4, M6.2)
- `google/gemma-4-E2B-it` - Hugging Face, Colab/CUDA (companion Colab do M4.2)
- `gemma4:e2b` - Ollama, local (demo de GRPO do M1.3)

Risco diferente do Gemini: um peso já baixado **nunca para de funcionar** - não existe "aposentadoria" de arquivo no seu disco. O risco aqui é ficar pra trás, não parar de rodar: quando sair a próxima geração (Gemma 5, ou o que vier depois), o material vai continuar de fato funcionando com Gemma 4, só deixa de ser a fronteira.

**Onde isso aparece nesta disciplina:**

| Módulo | Arquivo |
|---|---|
| M1.3 | `modulo-01-decision-framework/grpo-verifiable-reward-demo.js` / `.py` |
| M4.2 | `modulo-04-lora-e-peft/local-lora-training-tool.js` / `.py`, `colab-lora-training-notebook.ipynb`, `colab-lora-training-companion.md` |

**Link de checagem, página oficial da Google, sempre atual (não precisa trocar quando sair a próxima geração):**
[huggingface.co/google](https://huggingface.co/google)

---

## A regra que nunca muda

Em todo script listado acima, trocar de modelo é **uma linha, não uma reescrita**: o nome fica numa constante isolada no topo do arquivo (`MODELO`, `MODELO_GENERICO`, `baseModel`, `MODEL_ID`, conforme o script), e o resto do código - upload, hiperparâmetro, avaliação, formatação de resposta - é idêntico não importa a versão exata. Isso já é prática consistente nos scripts principais que chamam a API Gemini diretamente: cada um já tem, no próprio cabeçalho, a data de retirement, o link de checagem acima, e qual constante trocar - não é preciso caçar essa informação, ela já está ao lado do código que você vai editar.

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
