# Companion: `colab-model-evaluation-notebook.ipynb`

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulo 5.4, alternativa multiplataforma ao MLX**

## O que é

O Módulo 5.4 fecha uma promessa do Módulo 4.4 ("avaliar contra os dois modelos reais que a disciplina já treinou, Vertex AI e local") rodando `avaliacao_modelo_local_tool.py`, que só existe em Python porque importa `mlx_lm` direto - Mac-only, mesma exceção do Módulo 4.2. Este notebook faz a mesma avaliação, mesmo conjunto de teste retido do Módulo 5.1 (11 exemplos, offset 5000, nunca vistos em nenhum treino), mesmas funções de adequação de schema e precisão por campo, só que contra o modelo treinado via Hugging Face (`colab-lora-training-notebook.ipynb`, Módulo 4.2) em vez do MLX.

**Estrutura**: Passos 1-4 são os mesmos do notebook do Módulo 4.2 (treino), reproduzidos aqui porque uma sessão Colab não persiste o adaptador de uma execução anterior. Passos 5-6, novos, são a avaliação: conjunto de teste retido embutido + funções do harness do Módulo 5.1 portadas + loop de avaliação real.

## Status de validação (honesto)

- Toda a base de treino (Passos 1-4) já validada e rodada com sucesso real no notebook do Módulo 4.2 (ver `colab-lora-training-companion.md`).
- As funções de avaliação portadas (`avaliar_adequacao_schema`, `avaliar_precisao_por_campo`, `remover_cerca_markdown`, `normalizar_texto`) foram testadas isoladamente contra os mesmos 5 casos de teste do harness real do Módulo 5.1 (JSON válido, campo faltando, cerca de markdown, diferença de acento, precisão parcial) - todos passaram.
- Um bug real foi encontrado e corrigido nesse processo: a célula de avaliação usava `json.loads` sem importar `json` explicitamente nela - funcionaria rodando o notebook inteiro em sequência (`Run all`, o `import json` da célula do dataset já deixa `json` disponível), mas quebraria se alguém rodasse só essa célula depois de reiniciar o runtime. Corrigido com import explícito no topo da célula, por robustez.
- **Número real de referência, capturado nesta mesma máquina (Apple M5 Pro) rodando `avaliacao_modelo_local_tool.py` de verdade antes de escrever este notebook**: 11/11 schema válido, 100,0% de precisão média por campo.

## Resultado real (Colab, T4)

Revalidado em 31/08 depois da correção do split de treino (157/30/13, agrupado por entidade - substitui o split antigo 160/30/10). Execução completa (Passos 1-6, outputs reais salvos no notebook) confirmada em 11/09.

Treino: 20 passos, 61,5s, loss de treino final 0,9562, loss de validação final 0,8190, acurácia média de token 79,7% (números muito próximos aos do notebook do Módulo 4.2 - mesma semente, mesmo dataset, mesmo hiperparâmetro - mas não idênticos: pequena variação é esperada por não-determinismo de kernels de GPU entre sessões Colab distintas; cada notebook treina seu próprio adaptador do zero porque a sessão Colab não persiste entre notebooks).

**Avaliação real contra o conjunto de teste retido do Módulo 5.1**: 11/11 schema válido, 100,0% de precisão média por campo - todos os 11 exemplos saíram com os 3 campos certos. Convergência exata com o MLX (Módulo 5.4, Apple Silicon: também 11/11, 100,0%): o mesmo achado qualitativo confirmado por um segundo framework, robustez real e não específica de um provedor ou framework.

## Quando usar

Pra alunos sem Mac Apple Silicon que treinaram via `colab-lora-training-notebook.ipynb` (Módulo 4.2) e querem completar a mesma avaliação de robustez que o Módulo 5.4 faz - terceiro modelo, mesma vara de medir.

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
