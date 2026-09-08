# Companion: `colab-lora-training-notebook.ipynb`

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulo 4.2, alternativa multiplataforma ao MLX**

## O que é

O Módulo 4.2 desta disciplina treina LoRA local de verdade via `mlx-lm` (`local-lora-training-tool.js` e sua versão em Python, `local_lora_training_tool.py`), e o `mlx-lm` só roda em Apple Silicon. Este notebook faz a mesma coisa, mesmo modelo (`google/gemma-4-E2B-it`), mesmo dataset real de 200 exemplos (Amplitude Auto + Saúde Empresarial, Módulo 2.2), mesmo posto (rank 8), com o stack Hugging Face (`transformers` + `peft` + `trl`), que roda em qualquer GPU CUDA, inclusive a T4 gratuita do Colab. Resolve uma lacuna real da disciplina: hoje só existem 3 pontos com dependência real de macOS (M4.2, M5.4, M6.2), e a única alternativa pra quem não tem Mac era "documentar que não foi possível rodar" (Atividade 4, Dica de execução). Este notebook dá um caminho de execução real, não só de documentação.

Dois arquivos irmãos, mesmo grupo de "alternativa não-Mac", publicados junto: `gpu-cuda-anatomia-poster.html` (companion visual, corte transversal de uma GPU real, referenciado dentro deste notebook) e `local-lora-training-hf-tool.py` (o mesmo treino Hugging Face deste notebook, só que como script standalone — pra quem tem uma GPU CUDA de verdade, Windows ou Linux, em vez do Colab).

**MLX continua sendo o caminho oficial.** Os Módulos 4.3 e 4.4 usam os números reais do MLX (rank 4/8/16, full fine-tuning, comparação DoRA) pra toda análise de trade-off desta disciplina. O notebook Colab é o caminho B, auto-contido, sem depender do resto do repositório.

## Status de validação (honesto)

Rodado de verdade no Colab Pro (GPU T4, 14,56GB), do início ao fim, sem erro. Os outputs completos dessa execução real - célula por célula, incluindo o log de treino e a resposta do modelo no exemplo difícil - estão salvos no próprio `colab-lora-training-notebook.ipynb`, pra quem quiser conferir sem precisar rodar nada. Duas rodadas reais até chegar aqui:

- **1ª rodada**: `OutOfMemoryError` dentro de `prepare_model_for_kbit_training`, tentando alocar 8,75GB numa tacada só.
- **2ª rodada** (depois de mitigação de alocador/fragmentação): mesmo erro, no mesmo lugar - a mitigação de fragmentação não bastou.
- **Causa raiz real**, achada com um diagnóstico embutido no próprio notebook: `model.language_model.embed_tokens_per_layer.weight`, 2,35 bilhões de elementos - a tabela de "per-layer embeddings" que dá nome ao "E2B" (parâmetro bruto alto, computação efetiva baixa). `prepare_model_for_kbit_training` do `peft` promove todo parâmetro não-4bit pra float32 sem exceção de tamanho, e essa tabela sozinha já pede ~9,4GB. Corrigido reimplementando a função com um limiar de tamanho que pula esse upcast pra parâmetros grandes (a tabela fica congelada de qualquer jeito - LoRA não treina embedding).
- **3ª rodada, com o fix**: completou sem erro.

O que foi validado antes de qualquer rodada real: assinatura de `LoraConfig`/`SFTConfig`/`SFTTrainer`/`BitsAndBytesConfig` contra as versões instaladas (`peft==0.20.0`, `trl==1.10.0`, `transformers==5.15.1`), instanciação dos objetos com os valores reais do notebook, parsing do dataset embutido (200 exemplos, contagem 157/30/13 batendo), sintaxe de toda célula, e a lógica do fix de memória testada com mock antes de mandar pro usuário rodar.

## Resultado real (Colab Pro, T4)

Revalidado em 31/08 depois da correção do split (157 treino / 30 validação / 13 teste, agrupado por entidade - substitui o split antigo 160/30/10, que vazava pessoa entre treino e teste). Rodada nova, completa, sem erro.

- **Treino**: 20 passos (batch 1, mesmo orçamento do Módulo 4.2 real), 62,1s de duração.
- **Loss de treino no passo final**: 0,9579
- **Loss de validação no passo final**: 0,8305
- **Acurácia média de token**: 79,6%
- **Comparação com o Módulo 4.2 (MLX)**: lá, val loss foi de 4,752 → 0,895 (rank 8). Aqui, 0,8305 no passo final - mesma ordem de grandeza, mesmo padrão de queda acentuada, apesar de os dois frameworks não serem comparáveis número a número (ver nota sobre `scale` vs `lora_alpha` abaixo). Confirma a mesma conclusão qualitativa por dois caminhos de implementação diferentes: LoRA rank 8, orçamento curto de treino, já produz ajuste real e mensurável nesse dataset.
- **Teste do exemplo difícil (Passo 5)**: o exemplo tinha um distrator de propósito - placa e valor de uma revisão ANTERIOR (`QRS-1122`, R$ 890,00) misturados no texto, antes do sinistro de verdade (`TUV-4499`, R$ 2.310,75). O modelo ajustado extraiu certo: `{"segurado":"Roberta Almeida Castro","placa":"TUV-4499","valor":2310.75}` - ignorou o distrator, não decorou posição de texto.

## Diferenças conceituais em relação ao MLX (Módulo 4.2)

| Conceito | MLX (Módulo 4.2) | Este notebook (HF) |
|---|---|---|
| Fator de escala do LoRA | `scale: 20.0` | `lora_alpha: 16` |
| Learning rate | `1e-5` | `2e-4` |
| Não comparáveis número a número: cada framework aplica a escala do LoRA antes do learning rate de um jeito diferente. Comparar `val_loss` final é válido; comparar o valor bruto do LR não é. | | |
| Quantização | bf16 (sem quantização) | 4 bits (QLoRA), necessário pra caber na T4 grátis |
| Orquestração | `mlx_lm.lora` via subprocess | `SFTTrainer` (biblioteca `trl`) |

## Quando usar

Pra alunos sem Mac Apple Silicon que querem rodar fine-tuning local de verdade (não simular, não só ler os números do Módulo 4.2) como parte da Atividade 4 (Missão Prática #04), Passo 2. Referenciado no TP do Módulo 4.2 (resultado real citado: val loss 0,8305) e na Atividade 4 - Módulo 4.pdf (Missão Prática #04, Passo 2, como alternativa opcional pra quem não tem Apple Silicon).

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
