# Guia: rodando os comandos locais do Módulo 4 (MLX e alternativas)

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Companion - Módulos 4.2 e 4.4, dúvidas comuns de execução**

## O que é

Guia rápido pra quem tenta rodar, de verdade, os três comandos `mlx_lm` mostrados nos vídeos dos Módulos 4.2 e 4.4 e esbarra em erro de checkpoint ausente, ou não tem Mac com Apple Silicon pra rodar nenhum deles.

## Os 3 comandos reais

**1) Treino LoRA (Módulo 4.2)** - já funciona direto, sem nada extra, a partir de `modulo-04-lora-e-peft/`:

```bash
python3 -m mlx_lm lora --model mlx-community/gemma-4-e2b-it-bf16 --train --data ./mlx-data --fine-tune-type lora --iters 20 --batch-size 1 --learning-rate 1e-5 --adapter-path ./mlx-adapters
```

**2) e 3) Inferência com o checkpoint de full fine-tuning (Módulo 4.4)**, mesmos dois exemplos do restante do módulo (fácil e com distratores):

```bash
python3 -m mlx_lm generate --model mlx-community/gemma-4-e2b-it-bf16 --adapter-path mlx-full-finetune --prompt "Extraia beneficiário, procedimento e valor do recibo médico abaixo. [...]" --max-tokens 80

python3 -m mlx_lm generate --model mlx-community/gemma-4-e2b-it-bf16 --adapter-path mlx-full-finetune --prompt "Extraia segurado, placa e valor do orçamento de oficina abaixo. [...]" --max-tokens 80
```

Todos exigem **Mac com Apple Silicon** (M1 em diante) - `mlx_lm` é a biblioteca de ML nativa da Apple, não roda em Windows/Linux/Intel.

## Por que os comandos 2 e 3 dão erro de arquivo não encontrado

O checkpoint de full fine-tuning (`mlx-full-finetune/adapters.safetensors`) tem **2GB**. Os adaptadores LoRA usados no comando 1 (13 a 55MB, dependendo do posto) sempre estiveram neste repositório - mas o GitHub bloqueia push de qualquer arquivo acima de 100MB, então o checkpoint de full fine-tuning nunca pôde ser versionado aqui, mesmo sendo um artefato real desta disciplina.

## Baixando o checkpoint (Hugging Face Hub)

Resolvido subindo o checkpoint pro Hugging Face Hub, que não tem esse limite. Um passo só, antes de rodar os comandos 2 e 3 pela primeira vez:

```bash
hf download ahirtonlopes/amplitude-seguros-full-finetune --local-dir ./mlx-full-finetune
```

Depois disso, os comandos 2 e 3 rodam sem nenhuma alteração.

## Treinando o full fine-tuning você mesmo (em vez de só baixar)

Só em Mac Apple Silicon com bastante memória unificada - o pico real medido nesta disciplina foi **~15,3GB**. Abaixo disso, o processo tende a travar ou ficar lento demais pra ser prático:

```bash
python3 -m mlx_lm lora --model mlx-community/gemma-4-e2b-it-bf16 --train --data ./mlx-data --fine-tune-type full --iters 20 --batch-size 1 --learning-rate 1e-5 --adapter-path ./mlx-full-finetune
```

## Não tenho Mac - dá pra rodar em Colab?

**Pro treino LoRA (comando 1), sim**: `colab-lora-training-notebook.ipynb`, nesta mesma pasta, faz o mesmo treino LoRA via Hugging Face (`transformers` + `peft` + `trl`), rodável de graça numa GPU T4 do Google Colab. Já rodou de verdade, do início ao fim, sem erro - detalhes em `colab-lora-training-companion.md`.

**Pro full fine-tuning do modelo real do curso (Gemma 4 E2B, ~5,12 bilhões de parâmetros), não dá.** Não é falta de notebook - é limite físico: treinar todos os parâmetros desse modelo, mesmo com todas as otimizações padrão de mercado (otimizador de 8 bits, gradient checkpointing), precisa de entre 27GB e 74GB de memória, bem acima dos 16GB da T4 gratuita. Essa é, literalmente, a lição prática do Módulo 4.4: o ganho de qualidade do full fine-tuning existe, mas o custo de infraestrutura é real e alto.

**Pra sentir a mecânica de full fine-tuning genuíno mesmo sem Mac**, em escala menor: `colab-full-finetune-training-notebook.ipynb`, nesta mesma pasta - mesmo dataset real, mesmo orçamento de treino (20 passos), mas com um modelo bem menor (família Qwen, entre 0,6 e 1,7 bilhão de parâmetros reais, três opções selecionáveis), que cabe de verdade numa T4 grátis. Detalhes e status de validação honesto em `colab-full-finetune-training-companion.md`.

## Referências

- `local-lora-training-tool.js` / `local_lora_training_tool.py` - implementação de referência do treino LoRA (Módulo 4.2)
- `full-vs-lora-tradeoff-tool.js` / `full_vs_lora_tradeoff_tool.py` - números reais da comparação LoRA vs. full fine-tuning (Módulo 4.4)
- `colab-lora-training-notebook.ipynb` / `colab-lora-training-companion.md` - alternativa não-Mac pro treino LoRA
- `colab-full-finetune-training-notebook.ipynb` / `colab-full-finetune-training-companion.md` - alternativa não-Mac pro full fine-tuning, em escala reduzida
- `Atividade 4 - Módulo 4.pdf` - Missão Prática #04, onde esses comandos e notebooks se encaixam no fluxo de entrega

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
