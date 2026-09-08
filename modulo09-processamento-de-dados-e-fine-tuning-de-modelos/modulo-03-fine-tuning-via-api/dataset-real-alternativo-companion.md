# Extra: Dataset Real Alternativo (Dolly-15k)

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulos 3.2 a 3.4 (opcional, vale pra qualquer Missão Prática a partir do Módulo 3.5)**

Todas as Missões Práticas desta disciplina pedem duas coisas: use um caso do seu próprio contexto de trabalho, ou simule de forma realista. Este companion é uma terceira opção: se você não tem um caso de trabalho pronto e prefere não simular, aqui está um dataset **real**, público e citável, processado de ponta a ponta contra o pipeline completo desta disciplina, incluindo um job de fine-tuning real, treinado de verdade.

**Por que os arquivos vivem na pasta do Módulo 3, mas parte do conteúdo é conceitualmente Módulo 2.2:** pra não espalhar o extra em duas pastas diferentes, tudo fica aqui, nesta mesma pasta. Mas o pipeline tem duas partes bem separadas, e cada uma corresponde a um estágio diferente da disciplina:

| Parte | Arquivo | Conceitualmente equivalente a |
|---|---|---|
| 1/2 - Preparar dataset | `dolly-dataset-real-starter.js` / `.py` | **Módulo 2.2**: mapear pro schema canônico, dedup MinHash+LSH, balanceamento por temperatura |
| 2/2 - Upload, job, inferência | `dolly-vertex-pipeline.js` / `.py` | **Módulos 3.2-3.4**: conversão pro formato Vertex AI, upload, criação de job real, acompanhamento com backoff, inferência |

**Como ler esta seção:** O que é → Parte 1 → Parte 2 → Resultado real → Achado real → Correção pós-avaliação → Limite honesto → Fontes.

---

## 1. O que é

**databricks-dolly-15k**: 15.011 pares de instrução/resposta reais, escritos à mão por mais de 5.000 funcionários da Databricks entre março e abril de 2023, em 8 categorias de tarefa (baseadas na taxonomia do InstructGPT). Licença **CC-BY-SA-3.0**: uso comercial e acadêmico liberado, exige atribuição e mesma licença se você redistribuir uma versão adaptada.

**Baixe uma vez, localmente:**
```bash
curl -L "https://huggingface.co/datasets/databricks/databricks-dolly-15k/resolve/main/databricks-dolly-15k.jsonl" -o databricks-dolly-15k.jsonl
```
13MB, não versionado neste repositório de propósito (baixe você mesmo; evita duplicar 13MB por aluno que clonar a pasta).

## 2. Parte 1/2 - Preparar dataset (equivalente ao Módulo 2.2)

Só **3 das 8 categorias** do Dolly têm o campo `context` preenchido: `information_extraction` (1.506), `closed_qa` (1.773), `summarization` (1.188), 4.467 exemplos reais no total. As outras 5 (`open_qa`, `general_qa`, `classification`, `brainstorming`, `creative_writing`) não têm documento de entrada, só a instrução: não servem pro schema `instrução + entrada → saída` que este pipeline exige.

| Schema canônico (Módulo 2.1) | Campo do Dolly |
|---|---|
| `instrucao` | `instruction` |
| `entrada` | `context` |
| `saida` | `response` |
| `metadata.fonte` | `category` |

`dolly-dataset-real-starter.js` / `.py`: carrega o JSONL, mapeia, e roda o mesmo dedup MinHash+LSH e balanceamento por temperatura do Módulo 2.2, reusando as primitivas exportadas (`assinaturaMinHash`, `bandingLSH`, `similaridadeJaccardExata`, `balancearPorTemperatura`, `entropiaShannon`). O dedup compara `instrução + entrada` concatenados, não só `entrada` (ver seção 5, por quê). `prepararDatasetCompleto()`/`preparar_dataset_completo()` roda o pipeline inteiro contra os 4.467 exemplos completos, não uma amostra, e é exatamente o que gerou o dataset do job real. 14 testes automatizados em cada linguagem.

**Nota técnica pra quem for adaptar**: `encontrarQuaseDuplicatasMinHashLSH`/`limparEBalancear`, do Módulo 2.2, são hardcoded pros dois casos desta disciplina (`amplitude-auto`, `amplitude-saude-empresarial`). O dedup aqui reimplementa o mesmo laço de forma genérica em vez de patchear o arquivo original.

## 3. Parte 2/2 - Upload, job real, inferência (equivalente aos Módulos 3.2-3.4)

`dolly-vertex-pipeline.js` / `.py`: converte o dataset preparado na Parte 1 pro formato Vertex AI, sobe pro bucket, valida hiperparâmetro, cria um job de fine-tuning **real** (com a mesma trava de confirmação do Módulo 3.4), acompanha com backoff exponencial e retry em falha transiente, e roda uma inferência real contra o endpoint com `temperature=0`. 10 testes automatizados por linguagem, sem rede real (funções injetáveis, mesmo padrão do `finetuning-automation-tool.js`).

**Aviso de nomenclatura**: esse `temperature` é diferente da "amostragem por temperatura" da Parte 1/Módulo 2.2 (o parâmetro que controla o quanto o balanceamento se afasta da proporção bruta entre fontes). Aqui é o parâmetro de geração de texto do próprio LLM: controla o quanto a próxima palavra gerada se afasta da escolha mais provável. `temperature=0` deixa a geração determinística (sempre a resposta mais provável, sem aleatoriedade), o que torna um teste de inferência reproduzível de novo, ao contrário do padrão da API (que sorteia entre as opções mais prováveis a cada chamada).

**Adaptação real necessária**: a conversão do Módulo 3.2/3.4 faz `JSON.stringify(exemplo.saida)` porque o case Amplitude sempre extrai campo estruturado (`saida` é objeto). O Dolly tem resposta em texto solto (`saida` é string): a conversão aqui usa o texto direto. Sem esse ajuste, a resposta esperada do modelo sairia com aspas duplas extras em volta, um erro sutil que só aparece olhando o dataset convertido de perto.

## 4. Resultado real

Rodado de verdade em 25/08/2026, contra o projeto `amplitude-seguros-demo`, mesmo projeto usado no resto da disciplina.

- **Job**: `tuningJobs/7943269068780339200`, estado `JOB_STATE_SUCCEEDED`
- **Dataset final**: 200 exemplos (71 closed_qa, 66 information_extraction, 63 summarization), hash SHA-256 `412c38ced42acc2d72e0b176408bdbccc3a7be3dd624e0823bd3f56ca125fe9a`
- **Duração real**: 13min09,9s
- **Modelo ajustado**: `models/1541366318316388352@1`
- **Endpoint**: `endpoints/3331226112800849920`
- **Tokens cobráveis**: 67.668
- **Model card completo**: `model-card-dolly-extra-200.md`, nesta mesma pasta

**Inferência real de teste** (temperature=0), mesma pergunta do dataset ("When did Virgin Australia start operating?"): "Virgin Australia commenced services on 31 August 2000 as Virgin Blue." Correta, direta, fiel ao contexto - sem nenhuma informação inventada, diferente do job v1 (seção 6). O dataset de treino é byte-idêntico ao da v1 (mesmo hash), então a melhora vem só do hiperparâmetro corrigido: comparação controlada real, não hipótese.

## 5. Achado real: dedup em dado real não é igual dedup em dado sintético

Rodando o dedup completo (não uma amostra) contra os 4.467 exemplos compatíveis, comparando `instrução + entrada`: **778 candidatos via LSH, 748 pares confirmados, 396 itens únicos removidos** (pares se sobrepõem: 748 pares não significa 748 itens diferentes). Isso ainda inclui pares de verdadeira duplicata, mas evita o problema que a primeira versão deste companion tinha: comparar só `entrada` confundia pares de **pergunta diferente sobre o mesmo trecho de contexto** com duplicata real. Exemplo real: "What caused the Global Financial Crises?" e "What caused the 2007-2008 financial crisis?" compartilham o texto-fonte inteiro (Jaccard = 1,0 só na `entrada`), mas são duas perguntas genuinamente diferentes, cada uma um exemplo de treino válido. Com `instrução + entrada`, esse par específico não é mais candidato a duplicata.

## 6. Correção pós-avaliação (25/08/2026)

Depois de publicar a primeira versão deste extra, pedi uma avaliação de um painel de 5 especialistas em fine-tuning (rigor técnico, práticas de produção, honestidade científica, valor pedagógico, comparação com mercado). O painel confirmou que o job real funcionava e os números não eram fabricados, mas achou problemas reais, que verifiquei um a um antes de corrigir:

- **`learning_rate_multiplier=1` contradizia o que o Módulo 3.3 ensina** pro mesmo volume de dado (200 exemplos, 3 épocas): um multiplicador baixo "andaria devagar demais pra produzir ajuste perceptível", segundo a própria disciplina. É plausível que isso explique (ao menos em parte) o comportamento de "modelo quase igual ao base" observado na inferência de teste original. Corrigido pra `learning_rate_multiplier=5`, igual ao case Amplitude, com a mesma justificativa.
- **O dedup comparava só `entrada`**, um problema que a v1 deste companion já identificava em texto, mas não corrigia no código que efetivamente gerou o dataset do job real. Corrigido: agora compara `instrução + entrada` (seção 5).
- **Faltava validação de hiperparâmetro** antes de criar o job real e cobrável, diferente do padrão já estabelecido no Módulo 3.4. Corrigido: `validarHiperparametros`/`validar_hiperparametros`, mesma faixa (época 1-20, multiplicador 0,1-10).
- **O script publicado não reproduzia os números do resultado**: só processava amostra de 1.500, não os 4.467 completos. Corrigido: `prepararDatasetCompleto()` roda o pipeline inteiro.
- **Faltava retry em falha transiente no polling** e cache de token de acesso (chamava `gcloud` a cada consulta, sem necessidade). Corrigidos.
- **A inferência de teste original não documentava `generationConfig`**: geração de LLM é estocástica, sem isso o mesmo teste não é reproduzível. Corrigido: `temperature=0` por padrão.

O job original (`tuningJobs/7139833932131860480`, multiplicador 1) não foi apagado nem escondido: ficou como exemplo real de como um hiperparâmetro mal escolhido, contrariando a própria recomendação da disciplina, produz um sintoma real e observável. O job novo (multiplicador 5) confirmou a hipótese: mesma pergunta de teste, mesmo dataset (hash idêntico, ver model card), resposta completamente diferente - de um parágrafo com CEO e rota inventados pra uma frase correta e fiel ao contexto. Comparação real, controlada, documentada no model card, não uma suposição não-testada.

**Sem acesso a GCP e não quer nem simular?** Essa comparação v1/v2 é a base da terceira opção de entrega do Passo 4 da Atividade 3 (Módulo 3.5): em vez de rodar (ou simular) um job próprio, dá pra preencher a mesma ficha de versionamento usando os dados reais do job v2 como objeto de estudo, e responder por escrito por que o hiperparâmetro isolado explica a diferença de resultado. Detalhe completo na seção "Alternativa ao Passo 4" da própria Atividade 3.

## 7. Limite honesto

Não confirmei os termos de uso do dataset SROIE (recibos escaneados reais, ICDAR 2019) pra este mesmo propósito. Teria sido um segundo candidato natural pra quem quisesse repetir a tarefa de OCR+extração do Módulo 2.1 com documento real, não só instrução/resposta como o Dolly. Ficou de fora desta primeira versão do companion por essa incerteza de licença, não por não servir.

## Fontes

- Databricks, ["Free Dolly: Introducing the World's First Truly Open Instruction-Tuned LLM"](https://www.databricks.com/blog/2023/04/12/dolly-first-open-commercially-viable-instruction-tuned-llm) (abr/2023).
- [databricks/databricks-dolly-15k · Hugging Face](https://huggingface.co/datasets/databricks/databricks-dolly-15k) (dataset + licença CC-BY-SA-3.0).

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
