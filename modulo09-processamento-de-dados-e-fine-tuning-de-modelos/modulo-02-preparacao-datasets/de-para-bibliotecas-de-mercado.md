# De/Para: Nosso Pipeline vs. Bibliotecas de Mercado (Módulo 2)

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Documento extra, fora da ementa oficial - Módulo 2 (Preparação de Datasets para Fine-Tuning)**

Este documento é material extra, complementar ao Módulo 2 (não é parte do vídeo gravado): pra cada peça que construímos do zero no Módulo 2, mostra qual biblioteca de mercado resolveria o mesmo problema hoje (pesquisa feita em 2026-08-22, campo em evolução rápida), valida contra o código real desta disciplina, e explica por que construímos na mão em vez de importar uma lib pronta - às vezes foi escolha pedagógica, às vezes foi porque a lib simplesmente não existe.

**Como ler cada linha:** O que nosso código faz -> Biblioteca(s) de mercado equivalente -> Por que construímos do zero -> Status real 2025-2026 (com fonte).

---

## TL;DR

- **3 das 6 peças construídas do zero no Módulo 2 não têm alternativa de mercado madura, nem em Python nem em JavaScript** (deduplicação completa, amostragem por temperatura, validação de schema JSONL) - não foi atalho didático, é que a lib não existe.
- **2 peças tinham lib pronta e a escolha de construir foi só pedagógica** (normalização de texto, similaridade) - num pipeline de produção real, `natural`/`compromise` e `fastest-levenshtein` resolveriam sem reinventar nada.
- **2 peças nem são pergunta de "construir vs. comprar"**: o gate de relevância é lógica de negócio da Amplitude Seguros, e a higienização de PII já está no companion do M2.1.
- Pesquisa de mercado real, verificada ao vivo em 22/08/2026 (downloads/semana, status de manutenção, fonte primária) - não é opinião, é checagem.

*Quer o detalhe de cada linha, com fonte e número? Continue lendo. Só quer o veredito? Pare aqui.*

---

## Resumo executivo

| Componente do M2 | Existe lib de mercado madura? | Por que construímos do zero |
|---|---|---|
| Deduplicação (MinHash+LSH) | Madura em Python; em JS só a metade (MinHash sem LSH banding) | **Forçado**: banding LSH não existe pronto em nenhuma lib JS |
| Amostragem por temperatura | Não, nem em Python (é fórmula de paper, não lib) | **Forçado**: nem o próprio Google publica isso como lib genérica |
| Validação de schema JSONL por API | Não existe nem em Python, oficial de nenhum provedor | **Forçado**: o mercado inteiro também não resolveu isso |
| Normalização de texto básica | Sim, `natural`/`compromise`, maduras e ativas, em JS | **Escolha pedagógica**: dava pra usar uma lib |
| Similaridade/fuzzy match | Sim, `fastest-levenshtein`/`fast-levenshtein`, maduras, em JS | **Escolha pedagógica**: dava pra usar uma lib |
| Gate de relevância (4 perguntas) | Não existe (é lógica de negócio, não um problema genérico) | Não aplicável: não é o tipo de coisa que vira lib |
| Extração de campo (OCR + regex) | Parcialmente (OCR sim, parsing de layout de seguradora não) | Domínio específico demais pra lib genérica cobrir a parte de parsing |
| Higienização de PII | Sim, Microsoft Presidio é a referência - **já documentado** | Ver `privacy-preserving-finetuning-companion.md` (M2.1), não repetido aqui |

A linha mais importante desta tabela: **três dos seis componentes construídos do zero não têm alternativa de mercado madura, nem em JavaScript nem em Python** (dedup, amostragem por temperatura, validação de schema por API). Não foi atalho didático evitar uma lib - pesquisamos de verdade em 2026-08-22 e a lib não existe.

---

## 1. Deduplicação: `encontrarQuaseDuplicatasMinHashLSH` / `similaridadeJaccardExata`

**O que nosso código faz** (`dataset-cleaning-balancing-tool.js`, funções `hashString`, `assinaturaMinHash`, `bandingLSH`, `encontrarQuaseDuplicatasMinHashLSH`, `similaridadeJaccardExata`): implementa MinHash (k=32 hashes) + LSH banding (b=8 bandas, r=4 linhas) do zero em JavaScript vanilla, sem nenhuma dependência externa. Rodando de verdade contra o dataset simulado da Amplitude Seguros: 549 pares força-bruta reduzidos a 20 candidatos LSH (96,4% de redução), 3 quase-duplicatas reais confirmadas após refino por Jaccard exato, zero falso negativo nos testes.

**Biblioteca de mercado equivalente:**
- **Python**: `datasketch` (ekzhu/datasketch) é o núcleo de fato usado por quase todo pipeline de dedup de LLM - inclusive por `text-dedup`, `datatrove` (Hugging Face, usado pra construir o FineWeb) e indiretamente pelo NVIDIA NeMo Curator. Ativa, ~4,5 milhões de downloads/mês no PyPI, mas o próprio mantenedor pediu colaboradores em 2025/2026 por estar mudando de foco.
- **JavaScript/Node**: **não existe equivalente vivo da técnica completa (MinHash + LSH banding).** Quatro opções reais, nenhuma completa:
  - `minhash` (npm): parado na versão 0.0.9 há cerca de 8 anos.
  - `minhash-node-rs` (Rust-pra-Node): 15 estrelas, sinal fraco de atividade.
  - `bloom-filters` (Callidon/bloom-filters, npm, ~455 mil downloads/semana, verificado em 2026-08-22): implementa MinHash de verdade (`add()`, `bulkLoad()`, `compareWith()`), mas **só a assinatura e a comparação par-a-par**, sem banding/bucketing - ou seja, sem a peça que evita O(n²) e que fez nossos 549 pares virarem 20 candidatos. Sozinho, pra um dataset grande, ainda exigiria comparar todo par - o problema que o LSH banding existe pra evitar.
  - Banco vetorial externo (Milvus, índice `MINHASH_LSH` nativo desde a v2.6, função server-side desde a v3.0-beta de maio/2026, via SDK Node oficial): única forma de ter o pacote completo (assinatura + indexação por banda) hoje em JS - mas delega pra um serviço externo, não é uma lib local.

**Por que construímos do zero**: forçado pra técnica completa. Mesmo usando `bloom-filters` pra assinatura MinHash, a peça de banding LSH (`bandingLSH`, `encontrarQuaseDuplicatasMinHashLSH` no nosso código) ainda precisaria ser escrita na mão - nenhuma lib JS entrega isso pronto. O código implementado nesta disciplina é, na prática, uma reimplementação didática completa do que `datasketch` faz em Python - o aluno aprende o algoritmo real de ponta a ponta, incluindo a parte que nem `bloom-filters` cobre.

**Tendência de mercado a observar**: MinHash não está sendo substituído, está sendo complementado. Ferramentas de ponta (NVIDIA NeMo Curator, e a lib mais nova `MinishLab/semhash`) já combinam MinHash (dedup sintática, o que fazemos aqui), MD5 (dedup exata) e embeddings + busca por vizinho aproximado (dedup semântica, sentido igual/palavras diferentes) como três estágios complementares. Se este módulo ganhar uma v2, dedup semântica via embedding é a extensão natural.

**Fontes**: github.com/ekzhu/datasketch (incluindo discussão #252 sobre bus factor) · github.com/ChenghaoMou/text-dedup · github.com/huggingface/datatrove · docs.nvidia.com/nemo/curator (v26.02) · npmjs.com/package/minhash (última publicação ~2018) · github.com/Callidon/bloom-filters (v3.0.4, lançada 2 anos atrás, ~455 mil downloads/semana em ago/2026, README confirma ausência de banding/bucketing).

---

## 2. Amostragem por temperatura: `pesosAmostragemPorTemperatura` / `balancearPorTemperatura`

A ideia central, antes da fórmula: fonte com muito exemplo passa a pesar menos, fonte com pouco exemplo passa a pesar mais - a "temperatura" só controla o quanto desse ajuste acontece. O resto desta seção é como isso vira código e o que o mercado oferece pronto (nada, como vai ficar claro).

**O que nosso código faz**: implementa a fórmula real do paper T5/mT5 (peso proporcional a `contagem^alpha`, alpha=0,3, exatamente a convenção de Xue et al. 2021/mT5 - o próprio comentário do código cita Raffel et al. 2020 e Xue et al. 2021) pra corrigir concentração de fonte sem inventar exemplo. Rodando de verdade: Amplitude Auto vai de 53,8% de concentração numa fonte só pra 40%, número efetivo de fontes sobe de 3,28 pra 3,74; Amplitude Saúde Empresarial vai de 61,1% pra 50%, número efetivo de 2,54 pra 2,81 - sempre alocando pelo resto maior (`alocarMaiorResto`), nunca fracionando exemplo.

**Biblioteca de mercado equivalente**: não existe pacote de propósito geral pra isso, nem em Python (verificado direto no índice do PyPI e do npm, zero pacote relevante). A implementação de referência real vive dentro do código de pesquisa do próprio Google - mas atenção a uma nuance real, checada linha a linha no código-fonte: `seqio`/`t5x` (`seqio/utils.py`, função `mixing_rate_num_examples`) implementa `r^(1/T)`, a convenção original de Raffel et al. 2020 (T5) - **diferente** da convenção que nosso código usa, `n^alpha` (Xue et al. 2021/mT5). São parametrizações relacionadas do mesmo conceito (peso decrescente pra fonte dominante), não a mesma fórmula literal - nosso código já cita as duas fontes corretamente, mas "a mesma fórmula" seria impreciso. O Hugging Face `datasets` oferece um mecanismo equivalente em espírito via `interleave_datasets(probabilities=...)`, mas recebe probabilidade fixa informada pelo usuário, não calcula a exponenciação por temperatura internamente. Pra desbalanceamento de classe em geral (não especificamente temperatura), o padrão de mercado é `imbalanced-learn` (Python, ativo, v0.14.2 confirmada em 7/jun/2026). Em JS/Node: nenhum equivalente dedicado - o `classWeight` do `model.fit()` do TensorFlow.js é só um mapa estático classe-peso definido pelo usuário, sem nenhuma lógica de exponenciação por temperatura no código-fonte.

**Por que construímos do zero**: forçado - nem em Python existe uma lib de propósito geral, só as duas variantes específicas de framework de pesquisa (`seqio`/`t5x` com `r^(1/T)`, e o código real desta disciplina com `n^alpha`, a variante mT5). Não existe "biblioteca melhor" que isso substituiria; existe, no máximo, uma escolha entre duas parametrizações do mesmo princípio, e o código daqui documenta corretamente qual das duas usa.

**Sucessor a observar**: a literatura 2023-2025 já aponta o UniMax (ICLR 2023, usado no UMT5) como evolução da temperatura fixa, corrigindo limitação conhecida dela. Não é só citação acadêmica antiga: o Gemma 3 Technical Report (Google DeepMind, mar/2025) confirma que o pré-treino do próprio Gemma 3 - a família de modelo usada no piloto local desta disciplina - usa UniMax pra balancear idioma. Não é urgente pra esta disciplina (o alpha=0,3 fixo já é honesto sobre suas limitações no vídeo), mas é a referência certa se um aluno perguntar "e depois da temperatura, o que vem?".

**Fontes**: github.com/google-research/text-to-text-transfer-transformer (seqio/t5x) · huggingface.co/docs/datasets (interleave_datasets) · pypi.org/project/imbalanced-learn (v0.14.2, jun/2026) · paper UniMax, ICLR 2023.

---

## 3. Validação de schema JSONL por API: `validarExemplo` / deferido pros Módulos 3 e 4

**O que nosso código faz**: `extraction-to-jsonl-tool.js` valida um schema canônico próprio (instrucao/entrada/saida/metadata) - deliberadamente genérico, o próprio TP do M2.1 explica que a conversão pro formato específico de cada API (Vertex AI `contents/role/parts`, MLX-LM `messages/role/content`) fica pros Módulos 3 e 4.

**Biblioteca de mercado equivalente**: **não existe, de nenhum provedor, mesmo em 2026.** A OpenAI só tem um notebook de exemplo no Cookbook (não é pacote instalável). O Google documenta o formato "Prepare data" da Vertex AI mas a validação real só acontece no servidor, ao criar o job - não há SDK/CLI local de schema-check. O MLX-LM valida implicitamente ao carregar o dataset (lança erro se o schema não bater), mas sem relatório de validação dedicado. Ferramentas de terceiros existem mas são minúsculas e mal mantidas (`gh640/openai-fine-tuning-validate`, 4 estrelas). O Hugging Face `datasets`/TRL padronizam um formato "conversational" próprio, mas não validam contra o schema exato de nenhuma API comercial.

**Por que construímos do zero**: forçado - o próprio mercado não resolveu isso de forma unificada. A decisão pedagógica de usar um schema canônico genérico no M2 e adiar a conversão específica pra M3/M4 é, na prática, o mesmo padrão que ferramentas de tradução como o LiteLLM adotam (conversão sob demanda entre formatos, não um validador universal único). Contexto que reforça a decisão: a OpenAI confirmou (developers.openai.com/api/docs/deprecations, checado em 2026-08-22) que está descontinuando toda a plataforma self-serve de fine-tuning - orgs novas já bloqueadas desde 7/mai/2026, todo cliente perde a capacidade de criar job novo em 6/jan/2027. Investir num validador universal pro formato de um provedor que está saindo do mercado seria o oposto de pragmático - o schema canônico genérico, agnóstico de provedor, envelhece melhor.

**Fontes**: OpenAI Cookbook, "Data preparation and analysis for chat model fine-tuning" · Google Cloud, "Prepare supervised fine-tuning data" (Vertex AI, doc atualizada 2026) · github.com/BerriAI/litellm (função `_gemini_convert_messages_with_history`) · huggingface.co/docs/datasets (dataset formats and types, referenciando `trl` v1.10.0/`datasets` >=4.7.0).

---

## 4. Normalização de texto e similaridade: `normalizarTexto` / `similaridadeJaccardExata`

**O que nosso código faz**: `normalizarTexto` (minúsculas + colapso de espaço) e a etapa de refino exato por shingles/Jaccard são poucas linhas de JS vanilla, sem dependência.

**Biblioteca de mercado equivalente**: aqui sim existe opção madura e atual em JS - números abaixo são downloads/semana reais, checados ao vivo em 2026-08-22 (a primeira pesquisa citou número já desatualizado em algumas destas, corrigido aqui):
- **`natural`**: v8.1.1 (27/fev/2026), a mais completa (stemming, classificador, etc.) e hoje também a mais baixada das três NLP libs leves: **1,19 milhão de downloads/semana**, crescimento de ~600-700% no último ano.
- **`compromise`**: v14.16.0 (14/jul/2026), ativa (12.150 estrelas, push recente em 20/jul/2026), **880 mil downloads/semana**, crescimento de ~333% no último ano - a que mais cresceu proporcionalmente das três.
- **`wink-nlp`** (+ `wink-nlp-utils`): **166 mil downloads/semana** (wink-nlp sozinho) - bem menor que as outras duas em volume e em crescimento (~142%), apesar de ser frequentemente citada como "a nova referência de performance". `wink-nlp-utils` não recebe commit desde março/2024.
- **Distância de edição/similaridade**: dois pacotes de nome parecido, resultado bem diferente do esperado:
  - `fastest-levenshtein`: 25,9 milhões de downloads/semana.
  - `fast-levenshtein` (sem "est", autor diferente): **144,9 milhões de downloads/semana** - MAIS baixado que o "fastest", provavelmente puxado por dependência transitiva de ferramenta de lint/teste, não escolha ativa. Vale citar os dois, não só um.
  - `string-similarity`: está arquivado (confirmado, `archived: true` no GitHub) mas **não foi abandonado no sentido de uso** - ainda soma 2,1 milhões de downloads/semana. O tempo parado é ~3 anos e 4 meses (arquivamento em mai/2023), não os "~6 anos" que a pesquisa original estimou.
- **`lodash`** (`_.deburr`, `_.words`): ainda muito usada em pipeline de limpeza, embora não seja lib de texto dedicada.

**Por que construímos do zero**: escolha pedagógica, não necessidade. `normalizarTexto` é simples o bastante que trazer uma dependência externa só pra isso seria over-engineering - mas é honesto reconhecer que, num pipeline de produção real, `natural` ou `compromise` cobririam essa etapa (e bem mais, como remoção de stopword e stemming) sem reinventar nada. Vale corrigir aqui uma alegação errada da primeira pesquisa: `wink-nlp` não é "a que mais cresce" - é a que menos cresce e a de menor volume das três libs comparadas, ao vivo, no npm.

**Fontes**: api.npmjs.org/downloads (consulta ao vivo, semana 15-21/08/2026, natural/compromise/wink-nlp/wink-nlp-utils/fastest-levenshtein/fast-levenshtein/string-similarity) · registry.npmjs.org (versões e datas) · api.github.com/repos (estrelas e status de arquivamento: aceakash/string-similarity, winkjs/wink-nlp-utils, spencermountain/compromise).

---

## 5. Gate de relevância (4 perguntas) e extração de campo (OCR + regex)

**O que nosso código faz**: `avaliarCandidato` (`data-relevance-scoring-tool.js`) aplica 4 perguntas de negócio pra decidir se um documento é dado relevante pra treino (ground truth observável, fluxo real, cobertura de variação, crivo de compliance) - rodando de verdade, 7 candidatos plausíveis da Amplitude Seguros, só 2 passam. `extraction-to-jsonl-tool.js` faz OCR + parsing tolerante a rótulo pra orçamento de oficina e recibo médico, com confiança de OCR real de 95,9%.

**Biblioteca de mercado equivalente**: não existe, e não é esperado que exista. O gate de relevância é lógica de negócio específica desta seguradora fictícia (o que conta como "dado relevante" muda por empresa e por tarefa) - nenhuma lib genérica resolve isso, é decisão de produto, não de engenharia. A parte de OCR em si tem opção de mercado madura (Tesseract, já mencionado alhures nesta disciplina como ferramenta real), mas o parsing do *layout específico* de um orçamento de oficina ou recibo médico continua sendo código sob medida em qualquer stack - nenhuma lib genérica de extração resolve documento não-padronizado de um domínio vertical sem alguma customização.

**Por que construímos do zero**: não é uma escolha entre "construir" ou "usar lib" - simplesmente não existe categoria de produto que resolva "decidir se ESTE documento da Amplitude Seguros serve pra treinar ESTE modelo".

---

## 6. Higienização de PII

**Já documentado em detalhe** em `privacy-preserving-finetuning-companion.md` (seção 1) - inclusive o próprio `pii-scrubbing-gate-tool.js` já cita o Microsoft Presidio como "ferramenta de referência de mercado" na própria saída do programa. Não repetido aqui pra evitar duplicar conteúdo já correto. Achado novo desta pesquisa, revalidado ao vivo (2026-08-22): em 2026, o Presidio migrou da Microsoft pra uma org independente ("Data Privacy Stack", presidio.dataprivacystack.org - transição descrita como em andamento, sem data única de conclusão, licença MIT mantida), e surgiram dois modelos PII abertos e leves novos que rodam on-premise sem mandar dado sensível pra API de terceiro: **OpenAI Privacy Filter** (22/abr/2026, Apache 2.0, model card oficial confirma F1 96,0% no benchmark PII-Masking-300k - a OpenAI também reporta uma versão "corrected" do mesmo benchmark com F1 97,4%, número ainda melhor que o citado aqui) e **GLiNER2-PII** (arXiv:2605.09973, 11/mai/2026, 0,3B parâmetros, 42 tipos de entidade em 7 categorias) - que, aliás, se compara diretamente contra o OpenAI Privacy Filter no próprio paper e reivindica F1 melhor no benchmark SPY. Os dois modelos competem entre si; relevante justamente pro cenário de dado de saúde que este companion já discute.

---

## Conclusão: o que isso prova sobre o Módulo 2

A pesquisa de mercado confirma, com fonte, uma coisa que o material já demonstrava na prática: pra três das seis peças centrais do pipeline (dedup, balanceamento, validação de schema por API), **construir do zero não foi atalho didático - foi a única opção real**, porque o mercado (JS e, em boa parte, até Python) ainda não resolveu isso de forma madura e unificada. Pras outras duas (normalização, similaridade), existia lib pronta e a escolha de não usar foi pedagógica, pra ensinar o algoritmo. E pro gate de relevância e o parsing de documento, a pergunta "por que não usar uma lib" nem se aplica - é lógica de negócio, não um problema genérico.

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
