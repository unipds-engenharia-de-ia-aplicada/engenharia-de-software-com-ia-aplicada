# Model Card, modelo fine-tunado (dataset real alternativo, Dolly-15k)

> **Correção pós-avaliação (25/08/2026)**: esta é a v2 deste model card. Um painel de 5 especialistas em fine-tuning avaliou a v1 e achou problemas reais: `learning_rate_multiplier=1` contradizia o que o Módulo 3.3 ensina pro mesmo volume de dado, o dedup comparava só `entrada` (confundindo pergunta-diferente-mesmo-contexto com duplicata real), e a inferência de teste original não documentava `generationConfig`. Os três foram corrigidos e o job foi refeito. O job original (`tuningJobs/7139833932131860480`) não foi apagado, ver seção "Comparação real v1 vs. v2" no fim deste documento.

## Identificação
- Job: `tuningJobs/7943269068780339200`
- Modelo ajustado: `models/1541366318316388352@1`
- Endpoint: `endpoints/3331226112800849920`
- Estado: `JOB_STATE_SUCCEEDED`

## Linhagem
- Modelo base: gemini-2.5-flash
- Dataset de origem: databricks-dolly-15k (real, público, licença CC-BY-SA-3.0), não o case Amplitude Seguros
- Preparo: 15.011 exemplos brutos, 4.467 compatíveis com o schema canônico, dedup comparando instrução+entrada (748 pares confirmados, 396 itens únicos removidos, 4.071 restantes), balanceado por temperatura pra 200 exemplos (71 closed_qa, 66 information_extraction, 63 summarization)
- Dataset de treino: gs://amplitude-seguros-demo-tuning/dolly-extra-200-v2.jsonl
- Hash SHA-256 do dataset: `412c38ced42acc2d72e0b176408bdbccc3a7be3dd624e0823bd3f56ca125fe9a`

**Achado real ao gerar este dataset**: o hash do dataset v2 é **idêntico** ao da v1, apesar do dedup ter sido corrigido de verdade (748 pares confirmados contra 770 na v1, 396 itens removidos contra 410). Verificado por reprodução independente: regenerar o dataset do zero com o código corrigido produz o mesmo arquivo, byte a byte. Explicação: a correção do dedup muda quais pares são candidatos a duplicata, mas nenhum dos 14 itens que deixaram de ser removidos (410-396) estava entre os primeiros exemplos de cada categoria que o balanceamento por temperatura seleciona. Resultado prático: o dataset de treino da v1 e da v2 é o **mesmo dataset**, o que isola a causa da mudança de comportamento do modelo (seção abaixo) exclusivamente no hiperparâmetro, não no dado.

## Hiperparâmetros
- Épocas: 3
- Taxa de aprendizado (multiplicador): **5** (corrigido de 1 na v1; mesma justificativa do Módulo 3.3 pro mesmo n=200/3 épocas)
- Rank do adaptador (LoRA): ADAPTER_SIZE_FOUR

## Estatística do dataset
- Exemplos de treino: 200
- Tokens cobráveis no total: 67.668

## Linha do tempo
- Criado em: 2026-08-25T19:42:30.459738Z
- Concluído em: 2026-08-25T19:55:40.413493Z
- Duração real: 13min09,9s

## Custo estimado (referência de mercado)
- Faixa GPU cloud consumer (US$ 0,40-0,80/hora, cheatsheet do Módulo 1.3): US$ 0,09-0,18
- Faixa GPU cloud H100 (US$ 2,50-4,00/hora, cheatsheet do Módulo 1.3): US$ 0,55-0,88
Nota: a Vertex AI cobra por token de treino, não por hora de GPU alugada; esta faixa é referência de mercado pra comparar com o custo de rodar o mesmo tipo de treino (LoRA) em infraestrutura própria, não a fatura real deste job.

## Inferência real de teste (temperature=0, reprodutível)

Pergunta (exemplo do próprio dataset de treino, categoria closed_qa): "When did Virgin Australia start operating?"

Resposta do modelo ajustado: "Virgin Australia commenced services on 31 August 2000 as Virgin Blue."

**Avaliação da resposta**: correta, direta, e fiel ao contexto fornecido, praticamente idêntica à resposta de treino real ("Virgin Australia commenced services on 31 August 2000 as Virgin Blue, with two aircraft on a single route."). Nenhuma informação inventada fora do contexto, ao contrário da v1.

## Comparação real v1 vs. v2 (mesmo dataset, hiperparâmetro diferente)

| | v1 (`tuningJobs/...61480`) | v2 (`tuningJobs/...49200`) |
|---|---|---|
| Dataset (hash) | `412c38ce...` | `412c38ce...` (idêntico) |
| `learning_rate_multiplier` | 1 | 5 |
| Duração | 13min09s | 13min09,9s |
| Resposta à mesma pergunta de teste | "...operated its first flight on August 31, 2000, **between Brisbane and Sydney**. [...] led by CEO Brett Godfrey (2000-2010) [...]" (rota e histórico de CEO inventados, fora do contexto) | "Virgin Australia commenced services on 31 August 2000 as Virgin Blue." (correta, fiel ao contexto) |

Como o dataset é o mesmo dos dois lados, essa comparação isola o efeito do hiperparâmetro: `learning_rate_multiplier=1`, pra 200 exemplos e 3 épocas, não foi suficiente pra sobrepor o comportamento pré-treinado do modelo base, exatamente como o Módulo 3.3 já ensinava antes deste job existir. Não é uma hipótese não-testada: é um resultado real, reproduzido, com o dado controlado.

## Nota de validade (ago/2026)
Este model card documenta um job real, rodado com gemini-2.5-flash, contra um dataset público (não o case Amplitude Seguros desta disciplina). O processo -- upload, hiperparâmetro, versionamento -- é o mesmo independente da versão exata do modelo-base ou da origem do dataset. A Google aposenta versões do Gemini com aviso prévio (a família 2.5 tem retirement anunciado pra 16/out/2026); antes de treinar você mesmo, confira em [Vertex AI release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) quais modelos têm suporte a fine-tuning supervisionado no momento.
