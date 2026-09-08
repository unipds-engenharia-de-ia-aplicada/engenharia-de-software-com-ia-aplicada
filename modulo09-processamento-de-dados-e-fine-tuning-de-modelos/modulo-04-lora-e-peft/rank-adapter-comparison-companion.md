# Companion: `rank-adapter-comparison-tool.js`

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulo 4.3, companion da Demo (parte 2)**

## O que é

Roda o exemplo difícil do TP (Boa Vista Reparos Automotivos, dois valores distratores antes do valor certo) sem adaptador e com os três postos comparados no módulo — rank 4, 8 (reaproveita o adaptador real do Módulo 4.2) e 16. Mesmo modelo, mesmo prompt, saída real dos quatro.

## Resultado real (rodado em 04/09)

- **Sem adaptador**: 80 tokens, bate no limite, não chega a JSON.
- **Rank 4, 8 e 16**: todos acertam igual, campo a campo — `{"segurado":"Ricardo Alves Monteiro","placa":"JBR-9021","valor":2820}`.

Nenhum dos três postos foi separado por esse exemplo — mesmo resultado que a narração do TP descreve.

## Como rodar

```bash
node rank-adapter-comparison-tool.js
# ou: python3 rank_adapter_comparison_tool.py
```

Os três adaptadores (`mlx-adapters-rank4/`, `mlx-adapters-rank16/`, e o `mlx-adapters/` de rank 8 do Módulo 4.2) já vêm publicados no repositório com `adapters.safetensors` — não precisa treinar nada pra rodar o companion. Se quiser reproduzir algum treino do zero (outros hiperparâmetros, por exemplo), os comandos reais são:

```bash
# Rank 4
python3 -m mlx_lm lora --config lora-rank4-config.yaml

# Rank 16
python3 -m mlx_lm lora --config lora-rank16-config.yaml

# Rank 8 (reaproveita o adapter_path "./mlx-adapters" do Módulo 4.2)
python3 -m mlx_lm lora --config lora-rank8-config.yaml
```

Os três YAMLs já vêm com os hiperparâmetros reais usados nos treinos (`iters: 20`, `learning_rate: 1.0e-5`, `rank` correspondente); é só rodar cada um e esperar terminar antes de chamar o companion.

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
