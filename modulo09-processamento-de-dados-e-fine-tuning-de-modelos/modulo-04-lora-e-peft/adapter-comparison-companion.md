# Companion: `adapter-comparison-tool.js`

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulo 4.2, companion da Demo (parte 3)**

## O que é

O teleprompter do Módulo 4.2 descreve uma terceira parte da demo: rodar `python3 -m mlx_lm generate` duas vezes contra o mesmo exemplo real do conjunto de teste, uma vez sem `--adapter-path` e uma vez com, pra provar que o adaptador de 27MB muda o comportamento do modelo de verdade, não só na teoria. A gravação do módulo ficou sem tempo pra essa parte ao vivo. Este companion resolve isso: `adapter-comparison-tool.js` (e seu par em Python, `adapter_comparison_tool.py`) rodam exatamente essa comparação, de verdade, na própria máquina de quem estiver assistindo.

## Por que não foi só documentado

Porque o ponto da demo é justamente deixar o aluno ver a diferença rodando na própria máquina, não confiar na palavra do professor. O script carrega o exemplo real do conjunto de teste (índice 8 de `mlx-data/test.jsonl`, o mesmo dataset de recibos da Amplitude Seguros dos módulos anteriores), monta os dois comandos reais do `mlx_lm.generate`, roda os dois de verdade via subprocess, e compara token a token, campo a campo com o gabarito.

## Status de validação (honesto)

Rodado de verdade nesta máquina em 2026-09-04, com o adaptador do próprio treino gravado no vídeo do Módulo 4.2 (`mlx-adapters/`, rank 8, treinado ao vivo 09:51–10:35 no dia da gravação). Os 7 testes automatizados do script (contra essa mesma saída real, capturada como fixture) passam: `7/7 testes passaram`.

## Resultado real

Exemplo usado (índice 8, `mlx-data/test.jsonl`): recibo médico da Clínica Vitalis, beneficiário Felipe Alves Monteiro, procedimento "consulta de clínica geral", valor R$ 3.450,00. Gabarito: `{"beneficiario":"Felipe Alves Monteiro","procedimento":"consulta de clinica geral","valor":3450}`.

**Sem adaptador** (modelo base `mlx-community/gemma-4-e2b-it-bf16`, `--max-tokens 80`):

```
<|channel>thought
Here's a thinking process to extract the requested information:

1.  **Analyze the Request:** The user wants to extract three specific pieces of information from the provided text (a medical receipt/summary):
    *   Beneficiário (Beneficiary)
    *   Procedimento (Procedure)
    *   Valor (Value/Amount)

2.  **
```

80 tokens gerados — bateu no limite máximo, o modelo entra num modo de raciocínio em texto livre listando os passos e nunca chega a produzir o JSON.

**Com adaptador** (`--adapter-path ./mlx-adapters`, mesmo prompt, mesmo `--max-tokens 80`):

```
{"beneficiario":"Felipe Alves Monteiro","procedimento":"consulta de clinica geral","valor":3450}
```

28 tokens gerados, JSON exato, batendo campo a campo com o gabarito — num exemplo que nunca esteve nos 157 exemplos de treino.

## Como rodar

```bash
node adapter-comparison-tool.js
# ou, equivalente:
python3 adapter_comparison_tool.py
```

Cada rodada carrega o modelo do zero duas vezes (uma sem adaptador, uma com) e gera de verdade — leva uns 30-40s no total, sem rede nenhuma envolvida além do primeiro download do modelo (cacheado depois). Não é uma simulação nem um resultado pré-gravado: se você tiver retreinado o adaptador em `mlx-adapters/` com hiperparâmetros diferentes, os números podem sair diferentes — é esperado, é o ponto do script.

O adaptador rank 8 do Módulo 4.2 (`mlx-adapters/adapters.safetensors`, 27MB) já vem publicado no repositório — não precisa treinar nada pra rodar o companion. Se quiser reproduzir o treino do zero (outros hiperparâmetros, por exemplo), o comando real é:

```bash
python3 -m mlx_lm lora --config lora-rank8-config.yaml
```

Esse YAML já vem com os hiperparâmetros reais usados no treino gravado (`iters: 20`, `learning_rate: 1.0e-5`, rank 8, `adapter_path: ./mlx-adapters`) — é só rodar e esperar terminar antes de chamar o companion.

## Quando usar

Pra quem assistiu ao Módulo 4.2 e quer ver com os próprios olhos (rodando na própria máquina, Apple Silicon) a diferença prática entre "o processo de treino rodou sem erro" e "o modelo aprendeu o comportamento certo". Referenciado no teleprompter do Módulo 4.2 (Demo, parte 3) como o companion oficial pra essa comparação.

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
