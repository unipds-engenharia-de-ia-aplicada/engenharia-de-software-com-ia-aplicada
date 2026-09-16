# Companion: `colab-full-finetune-training-notebook.ipynb`

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulo 4.4, alternativa multiplataforma ao MLX, em escala reduzida**

## O que é

O Módulo 4.4 desta disciplina treina full fine-tuning local de verdade via `mlx-lm` (`--fine-tune-type full`), no modelo oficial do curso (Gemma 4 E2B, ~5,12 bilhões de parâmetros reais), e `mlx-lm` só roda em Apple Silicon. Este notebook faz a mesma mecânica - full fine-tuning genuíno, cem por cento dos parâmetros treináveis, sem LoRA -, mesmo dataset real de 200 exemplos (Amplitude Auto + Saúde Empresarial, Módulo 2.2), mesmo orçamento de treino (20 passos, learning rate 1e-5), com o stack Hugging Face (`transformers` + `trl` + `bitsandbytes`).

**Diferença deliberada e explicada no próprio notebook**: o modelo do Módulo 4.4 não cabe em full fine-tuning numa T4 grátis - a conta real de memória fica entre 27GB e 74GB, bem acima dos 16GB da GPU gratuita do Colab, e nenhuma otimização isolada resolve isso sem trocar de escala de modelo (quantizar os pesos, como QLoRA faz, impediria justamente treiná-los). Este notebook usa a família **Qwen3/Qwen2.5**, três opções entre ~0,6 e ~1,7 bilhão de parâmetros reais, selecionáveis no Passo 0, todas Apache 2.0 e sem exigir aprovação de licença na Hugging Face.

Resolve uma lacuna real: hoje já existe alternativa Colab pro LoRA do Módulo 4.2 (`colab-lora-training-notebook.ipynb`), mas quem não tem Mac nunca teve como sentir full fine-tuning genuíno rodando de verdade - só ler os números do Módulo 4.4 ou documentar que não foi possível rodar (a saída que a Atividade 4 já permite).

## Status de validação (honesto)

**Rodado de verdade numa GPU T4 real do Colab, do início ao fim, sem erro**, com o modelo default (`Qwen/Qwen3-1.7B`) e o otimizador de 8 bits (`bitsandbytes`) - mesmo nível de validação do `colab-lora-training-notebook.ipynb`. Os outputs completos dessa execução real - célula por célula - estão salvos no próprio `colab-full-finetune-training-notebook.ipynb`, pra quem quiser conferir sem rodar nada.

Antes da execução real em GPU, a lógica de todo o pipeline (chat template, dataset, `SFTTrainer` sem `peft_config`, geração pós-treino) já tinha sido validada localmente em CPU/MPS com `Qwen/Qwen3-0.6B` (mesma arquitetura/API do default), o que permitiu achar e corrigir, antes de qualquer rodada real, um problema real de contagem de parâmetros: a contagem "de marketing" dos três modelos (ex.: "Qwen3-1.7B") não bate com a contagem bruta que a API da Hugging Face retorna (`safetensors.total`), que por sua vez também não bate com o número de parâmetros treináveis de verdade - a diferença é a tabela de embedding contada duas vezes no arquivo salvo em disco (`embed_tokens` e `lm_head` compartilham peso em runtime, `tie_word_embeddings=True`, mas ficam separados no `.safetensors`). O notebook usa a contagem corrigida (treinável real) em toda a tabela do Passo 0 - confirmada de novo na execução real em GPU: `Qwen/Qwen3-1.7B` reportou exatamente 1.720.574.976 parâmetros treináveis, batendo com o valor calculado.

Versões das bibliotecas confirmadas atuais no PyPI em 16/09/2026 (`transformers==5.17.0`, `trl==1.13.0`, `accelerate==1.15.0`, `datasets==5.0.1`, `bitsandbytes==0.50.2`).

## Resultado real (Colab, GPU T4)

- **Treino**: 20 passos (batch 1, mesmo orçamento do Módulo 4.4 real), 38 segundos de duração.
- **Loss de treino no passo final**: 1,444
- **Loss de validação no passo final**: 1,302
- **Acurácia média de token**: 75,0%
- **Pico real de memória de GPU**: 13,51GB - cabe na T4 de 16GB, com ~2,5GB de folga (dentro da faixa estimada na tabela abaixo, mais perto do cenário de 10 bytes/parâmetro que do de 6).
- **Comparação com o Módulo 4.4 (MLX, Gemma 4 E2B)**: lá, val loss final do full fine-tuning foi 0,612 (contra 1,302 aqui) - os dois modelos e frameworks não são comparáveis número a número (escala de modelo, pré-treino e otimizador diferentes), mas confirmam a mesma conclusão qualitativa: full fine-tuning genuíno, mesmo com orçamento curto (20 passos), já produz ajuste real e mensurável.
- **Teste do exemplo difícil (Passo 4)**: o modelo extraiu corretamente os três campos centrais, ignorando o distrator de propósito (`placa: TUV-4499`, `valor: 2310.75`, não a revisão antiga `QRS-1122`/R$ 890,00) - confirma que aprendeu o padrão de extração, não decorou posição.
- **Achado real, documentado sem maquiagem**: a resposta do exemplo difícil trouxe campos extras que não existem no dataset de treino (`data`, `oficinas`, `data_pagamento`) e não fechou o JSON dentro do orçamento de `max_new_tokens=100`. Não invalida o teste central, mas mostra que 20 passos, suficientes pra travar o formato de saída no LoRA do Módulo 4.2 (adaptador pequeno, mudança cirúrgica sobre um comportamento já restrito), não bastaram pra travar o formato tão rigidamente num full fine-tuning de um modelo maior. Documentado como nota dentro do próprio notebook, com sugestão de experimento (aumentar `max_new_tokens`).

## Estimativa de memória por modelo (Passo 0 do notebook)

| Modelo | Parâmetros treináveis reais | 6 bytes/parâmetro (otimizador 8 bits) | 10 bytes/parâmetro | 16 bytes/parâmetro (Adam ingênuo) |
|---|---|---|---|---|
| `Qwen/Qwen3-1.7B` (default) | 1.720.574.976 | ~10,3GB | ~17,2GB | ~27,5GB |
| `Qwen/Qwen2.5-1.5B-Instruct` | 1.310.340.608 | ~7,9GB | ~13,1GB | ~21,0GB |
| `Qwen/Qwen3-0.6B` | 596.049.920 | ~3,6GB | ~6,0GB | ~9,5GB |

Só o cenário de 6 bytes/parâmetro (otimizador 8 bits + gradient checkpointing, exatamente a configuração default do notebook) cabe nos 16GB da T4 pros três modelos - o default (`Qwen3-1.7B`) fica com pouca folga pra ativações, o `Qwen3-0.6B` sobra bastante margem.

## Por que não o mesmo modelo do Módulo 4.4

Para contexto real, não estimado: a família Gemma 4 (a mesma versão do modelo oficial do curso) não tem nenhuma variante abaixo de ~5,12 bilhões de parâmetros reais - confirmado direto na API da Hugging Face, não existe um "Gemma 4 pequeno". Uma variante real e pequena existe na geração anterior (`google/gemma-3-1b-it`, ~1 bilhão de parâmetros), mas é "gated" - exige login na Hugging Face e aprovação manual da licença antes de baixar, fricção real pra um notebook autocontido que o aluno deve conseguir rodar direto com Runtime > Run all. A família Qwen, nas três opções oferecidas, não tem essa fricção.

## Quando usar

Pra alunos sem Mac Apple Silicon que já rodaram (ou tentaram rodar) `colab-lora-training-notebook.ipynb` e querem também sentir full fine-tuning genuíno rodando de verdade, não só ler os números do Módulo 4.4. Referenciado em `guia-execucao-local-modulo-4-companion.md` (pasta raiz de demos do Módulo 4) como resposta a dúvidas de execução dos comandos `mlx_lm` do Módulo 4.4.

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
