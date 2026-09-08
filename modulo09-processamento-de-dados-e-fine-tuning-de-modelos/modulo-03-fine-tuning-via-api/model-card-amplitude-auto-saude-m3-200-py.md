# Model Card, modelo fine-tunado

## Identificação
- Job: projects/113512199474/locations/us-central1/tuningJobs/4180970763655839744
- Modelo ajustado: projects/113512199474/locations/us-central1/models/391725756406824960@1
- Endpoint: projects/113512199474/locations/us-central1/endpoints/9091681879928602624
- Estado: JOB_STATE_SUCCEEDED

## Linhagem
- Modelo base: gemini-2.5-flash
- Dataset de treino: gs://amplitude-seguros-demo-tuning/m3-amplitude-auto-saude-200.jsonl
- Hash SHA-256 do dataset: f6eb8f99c30e5ecc1c3ec5f293ba831bccfde59b7cc12070ad03169ab91b52ed

## Hiperparâmetros
- Épocas: 3
- Taxa de aprendizado (multiplicador): 5
- Rank do adaptador (LoRA): ADAPTER_SIZE_FOUR

## Estatística do dataset
- Exemplos de treino: 200
- Tokens cobráveis no total: 27353

## Linha do tempo
- Criado em: 2026-08-08T02:38:12.307201Z
- Concluído em: 2026-08-08T03:23:54.310390Z

## Custo real
- Duração real do job: 45min 42s
- **Custo real, conferido no billing do Google Cloud (28/08/2026)**: R$2,39 (27.353 tokens faturáveis × 3 épocas = 82.059 unidades cobradas, à taxa real de R$0,00002909/unidade apurada no relatório de billing por SKU de agosto/2026)
- Faixa GPU cloud consumer (US$ 0,40-0,80/hora, cheatsheet do Módulo 1.3): US$ 0,30-0,61
- Faixa GPU cloud H100 (US$ 2,50-4,00/hora, cheatsheet do Módulo 1.3): US$ 1,90-3,05
Nota: a Vertex AI cobra por token de treino, não por hora de GPU alugada; a faixa de GPU acima é referência de mercado pra comparar com o custo de rodar o mesmo tipo de treino (LoRA) em infraestrutura própria - o valor real deste job específico é o R$2,39 conferido no billing, acima.

## Nota de validade (ago/2026)
Este model card documenta um job real, rodado com gemini-2.5-flash. O processo -- upload, hiperparâmetro, versionamento -- é o mesmo independente da versão exata do modelo-base. A Google aposenta versões do Gemini com aviso prévio (a família 2.5 tem retirement anunciado pra 16/out/2026); antes de treinar você mesmo, confira em [Vertex AI release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) quais modelos têm suporte a fine-tuning supervisionado no momento.

## Continuação: preference tuning (DPO)

O Módulo 3.5 vai além do fine-tuning supervisionado acima e testa preference tuning (DPO) sobre o mesmo modelo base: 40 dos 200 exemplos deste job foram convertidos em pares de preferência (`chosen`/`rejected`) - a extração correta de sempre (`chosen`) contra uma resposta real gerada por um prompt deliberadamente mais fraco (`rejected`, sem exigir JSON estrito). O dataset de preferência resultante está em `preference-dataset-amplitude.jsonl`, nesta mesma pasta.

- Job: `tuningJobs/3733013646142341120`
- Estado: JOB_STATE_SUCCEEDED
- Duração real: 17min 32s (mais rápido que o SFT acima, dataset 5x menor: 40 exemplos contra 200)
- Exemplos: 40 pares de preferência