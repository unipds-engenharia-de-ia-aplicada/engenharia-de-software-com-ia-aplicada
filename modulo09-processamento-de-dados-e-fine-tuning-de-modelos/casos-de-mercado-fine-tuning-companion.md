# Companion: Casos Reais de Fine-Tuning no Mercado

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Catálogo, disciplina inteira**

## Por que isso existe

O Módulo 6 conta a história da Amplitude Seguros - um case sintético, construído do zero pra esta disciplina, mas seguindo o mesmo rigor de qualquer projeto real. Três casos de mercado de verdade entraram na narração dos vídeos 6.1 e 6.3, pra mostrar que empresas reais resolvem exatamente o mesmo tipo de problema. Este companion é o panorama completo: 21 casos verificados, em 7 setores, pra quem quiser ver mais do que coube no roteiro.

**Critério de inclusão, aplicado a cada um dos 21:** empresa real, nomeada; fonte confiável (post técnico oficial da empresa, case study de provedor de nuvem/ML citando a empresa, paper técnico, ou reportagem de veículo de tecnologia estabelecido - nunca post pessoal não verificável); de preferência com métrica concreta; e, sempre que possível, confirmação explícita de que a técnica foi **fine-tuning** - não só prompt engineering, não só RAG. Vários candidatos conhecidos do mercado (Klarna, DoorDash, Stripe, Zalando, Wayfair, Uber, JetBrains Mellum, entre outros) foram investigados na fonte primária e descartados por não confirmarem fine-tuning - a nota de rigor no fim de cada setor documenta exatamente por quê.

---

## Saúde (clínico, diagnóstico, documentação médica)

### Google (Google Research) - Med-PaLM 2
**Técnica:** Fine-tuning de instrução sobre o PaLM 2, combinado na inferência com uma técnica de prompting ("ensemble refinement").
**O que fizeram:** Fine-tuning de instrução em dados médicos (MedQA, MedMCQA, PubMedQA, tópicos clínicos do MMLU, HealthSearchQA), avaliado lado a lado com resposta de médico humano, em painel cego com clínicos revisores.
**Resultado real:** 86,5% de acurácia no MedQA estilo USMLE (contra 67,2% do Med-PaLM anterior, ~19 pontos de ganho). Em 1.066 perguntas médicas de consumidor, médicos revisores preferiram a resposta do Med-PaLM 2 à de outros médicos humanos em 8 dos 9 eixos de qualidade clínica avaliados.
**Fonte:** [Towards Expert-Level Medical Question Answering with Large Language Models](https://arxiv.org/abs/2305.09617), arXiv, preprint 16/05/2023; versão revisada por pares na Nature Medicine, 2024.

### John Snow Labs - MedS (8B) e MedM (70B)
**Técnica:** Fine-tuning (incluindo LoRA) de modelos bem menores que os frontier models, para tarefas clínicas específicas.
**O que fizeram:** Sumarização clínica, extração de informação (NER, assertion/negação), Q&A biomédico e mapeamento de terminologia (RxNorm, ICD-10-CM), comparado formalmente contra o GPT-4o via revisão cega por médicos.
**Resultado real:** No estudo CLEVER (JMIR AI, revisado por pares), médicos preferiram os resumos do MedS (8B) aos do GPT-4o em fatualidade (47% vs. 25%) e relevância clínica (48% vs. 25%). Mapeamento RxNorm: 85% de acurácia contra 9% do GPT-4o, a US$4.500 vs. US$22.000 por milhão de registros.
**Fonte:** [Clinical LLM Evaluation by Expert Review (CLEVER)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12677871/), JMIR AI, 04/12/2025; benchmark complementar no [blog técnico oficial](https://www.johnsnowlabs.com/beyond-the-hype-john-snow-labs-medical-language-models-vs-frontier-llms-in-clinical-information-extraction/), 09/06/2025.

### M42 (operadora hospitalar de Abu Dhabi) - Med42-v2
**Técnica:** Fine-tuning supervisionado do Llama 3 (8B e 70B) sobre dado clínico, seguido de DPO (UltraFeedback e Snorkel-DPO), com a Cerebras.
**O que fizeram:** Uma operadora de hospitais reais (Cleveland Clinic Abu Dhabi, Moorfields Eye Hospital Abu Dhabi) construiu seu próprio modelo clínico a partir de um modelo aberto, e liberou os pesos publicamente.
**Resultado real:** Med42-v2-70B: 79,10 no MedQA zero-shot (estado da arte entre LLMs médicos abertos na época), até 87,3% no USMLE, superando o GPT-4 na maioria dos benchmarks clínicos avaliados.
**Fonte:** [Med42-v2: A Suite of Clinical LLMs](https://arxiv.org/abs/2408.06142), arXiv, 12/08/2024.

**Nota de rigor deste setor:** As três fontes são escritas (ou coautoradas) pela própria empresa dona do modelo, "resultado relatado pelo fabricante", mesmo passando por peer review formal. Descartados: Abridge, Nabla e Ambience Healthcare (não confirmam fine-tuning vs. RAG/prompting); Meditron (bem documentado, mas é consórcio acadêmico, não empresa).

---

## Jurídico (revisão de contrato, pesquisa jurídica, compliance)

### Harvey (com a OpenAI)
**Técnica:** GPT-4 customizado por pré-treinamento contínuo + pós-treinamento em ~10 bilhões de tokens de jurisprudência, com busca híbrida (RAG) e embeddings customizados. Programa de "custom models" direto com a OpenAI, não fine-tuning self-service.
**O que fizeram:** Testaram fine-tuning via API pública e RAG isolado primeiro, nenhum dos dois sozinho bastou para pesquisa jurisprudencial complexa. Testado às cegas por advogados de 10 dos maiores escritórios dos EUA.
**Resultado real:** 97% de preferência dos advogados pelo modelo customizado sobre o GPT-4 puro em teste cego; 83% mais respostas factualmente corretas; cada frase gerada ancorada numa citação real.
**Fonte:** [Customizing models for legal professionals](https://openai.com/index/harvey/), OpenAI Customer Stories, 2024.

### Thomson Reuters - CoCounsel
**Técnica:** Versão customizada do o1-mini (primeira customização enterprise do modelo), arquitetura multi-modelo (o1-mini, Gemini, Claude por tarefa).
**O que fizeram:** Raciocínio jurídico refinado, com destaque para detecção de sigilo profissional (privilege review) em e-discovery.
**Resultado real:** Segundo o CTO Joel Hron, o modelo identificou "instâncias situacionalmente nuançadas de sigilo profissional que antes passavam despercebidas até por modelos avançados como o GPT-4." Aumento de 1.400% no número de usuários do CoCounsel desde início de 2024 (métrica de adoção, não de acurácia isolada).
**Fonte:** [Transforming legal workflows with customized LLMs](https://legal.thomsonreuters.com/blog/transforming-legal-workflows-with-customized-ai-models/), Thomson Reuters, 10/12/2024; corroborado pela [VentureBeat](https://venturebeat.com/ai/thomson-reuters-cocounsel-redefines-legal-ai-with-openais-o1-mini-model), 25/11/2024.

### LexisNexis - Protégé
**Técnica:** Fine-tuning/destilação de modelo pequeno (Mistral) usado como roteador de intenção antes de escalar pra um modelo maior.
**O que fizeram:** Quebraram cada tarefa do assistente em componentes; um modelo fine-tuned pequeno decide a intenção antes de acionar um modelo caro. Objetivo: reduzir latência e custo, não maximizar acurácia bruta.
**Resultado real:** Nenhuma métrica numérica divulgada - só ganho qualitativo. Dado honesto incluído na fonte: um investimento anterior em RL com a Anthropic (desde 2023) "não fez diferença relevante" frente ao custo, segundo o próprio CTO.
**Fonte:** [Small models as paralegals](https://venturebeat.com/ai/small-models-as-paralegals-lexisnexis-distills-models-to-build-ai-assistant), VentureBeat, 20/03/2025.

**Nota de rigor deste setor:** Descartados: Robin AI + Claude (press release fala em "modelo híbrido" com dado proprietário, não confirma fine-tuning de parâmetro); Ironclad + OpenAI (métrica forte - revisão de contrato caindo de 40min pra 2min - mas mecanismo descrito é GPT-4 sobre "playbooks" via prompting, não fine-tuning confirmado).

---

## Atendimento ao cliente / suporte

### Intercom - Fin Apex 1.0 *(o case citado no vídeo 6.3)*
**Técnica:** Post-training / fine-tuning de reforço (RL) ancorado em outcome real, sobre modelo-base open-weight não divulgado.
**O que fizeram:** Treinaram um modelo pós-treinado especificamente pra resolução de ticket de suporte, usando bilhões de pontos de interação humano-agente e IA-agente reais, incluindo o desfecho de cada resolução.
**Resultado real:** 73,1% de taxa de resolução autônoma, contra 71,1% do GPT-5.4, 71,1% do Claude Opus 4.5 e 69,6% do Claude Sonnet 4.6 (benchmark da própria Intercom). Um cliente do setor de games viu resolução saltar de 68% para 75%. ~2 milhões de conversas resolvidas por semana.
**Fonte:** [Announcing Fin Apex: The age of vertical models is here](https://www.intercom.com/blog/announcing-fin-apex-the-age-of-vertical-models-is-here/), The Intercom Blog, 26/03/2026.

### Cresta - Ocean-1
**Técnica:** LoRA sobre cluster Mistral, servido via Fireworks AI (milhares de adaptadores LoRA sobre o mesmo cluster base, um por cliente/domínio).
**O que fizeram:** "Knowledge Assist" unifica FAQ, site e base interna em resposta em tempo real pra agente de atendimento, combinando LoRA com RAG. Clientes incluem Cox Communications e Holiday Inn.
**Resultado real:** Variantes fine-tuned do Ocean-1 superaram consistentemente o GPT-4 em tarefas de RAG, com redução de custo de até 100x por unidade de inferência.
**Fonte:** [How Cresta drives millions of real-time interactions with Fireworks](https://fireworks.ai/blog/story-cresta-knowledge-assist), Fireworks AI, 08/12/2024.

### T-Mobile - Expert Assist
**Técnica:** Fine-tuning de modelo de ASR (fala) via NVIDIA NeMo, servido via NVIDIA Riva.
**O que fizeram:** Fine-tuning com dado próprio (conversa real de call center, jargão de telecom, ambiente ruidoso) pro produto que transcreve ligação em tempo real e sugere solução ao agente.
**Resultado real:** Redução de 10 pontos percentuais na taxa de erro de palavra (WER) em ambiente ruidoso; melhoria de 10x na latência via Riva.
**Fonte:** [Speech AI for Award-Winning Customer Care](https://www.nvidia.com/en-gb/case-studies/speech-ai-for-award-winning-customer-care/), NVIDIA Customer Stories.

**Nota de rigor deste setor:** Excluídos deliberadamente: Klarna ("IA faz trabalho de 700 agentes") - fontes primárias (OpenAI, The Pragmatic Engineer) descrevem prompting + RAG + integração via API, sem confirmar fine-tuning. DoorDash - post oficial descreve RAG com "LLM Guardrail"/"LLM Judge" sobre GPT-4/Claude-3, sem menção a fine-tuning.

---

## Financeiro / fintech / seguros

### Nubank - nuFormer *(o case citado no vídeo 6.1)*
**Técnica:** Transformer causal (estilo GPT) treinado do zero sobre sequência de transação (24M e 330M parâmetros), fine-tuning supervisionado por tarefa, com LoRA no fine-tuning conjunto com rede tabular.
**O que fizeram:** Em vez de feature tabular manual (padrão da indústria), treinaram um transformer que aprende direto da sequência bruta de transação, depois fine-tuning pra tarefas de negócio (default de crédito, risco de empréstimo, previsão de renda/gasto). Em produção pra 100% dos clientes de um mercado, mais de 100 milhões de usuários.
**Resultado real:** +1,25% de AUC relativo sobre o baseline de produção (LightGBM) na tarefa principal - a própria Nubank descreve como 3x o ganho tipicamente observado em modelo com impacto de negócio relevante. Outras tarefas: +1,81% (default, outro mercado), +2,23% (risco de empréstimo), +7,54% F1 (renda), +6,85% R² (gasto).
**Fonte:** [Your Spending Needs Attention: Modeling Financial Habits with Transformers](https://arxiv.org/abs/2507.23267), Nubank, arXiv, jul/2025 (v2 ago/2026).

### EXL Service Holdings + NVIDIA - EXL Insurance LLM *(o case citado no vídeo 6.1)*
**Técnica:** SFT + LoRA via NVIDIA NeMo, complementado com NeMo Retriever (RAG) e NeMo Guardrails.
**O que fizeram:** EXL (BPO/analytics pra seguradora, Nasdaq: EXLS) construiu um LLM fine-tunado pra fluxo de seguro: leitura/resumo de sinistro, extração pra adjudicação, apoio a underwriting - sobre 25 anos de dado proprietário de sinistro.
**Resultado real:** 30% de melhoria de acurácia frente a LLM genérico de ponta, com 30% menos custo operacional.
**Fonte:** [EXL launches specialized Insurance LLM leveraging NVIDIA AI Enterprise](https://www.exlservice.com/about/newsroom/exl-launches-specialized-insurance-large-language-model-leveraging-nvidia-ai-enterprise), EXL Newsroom, 26/09/2024; confirmado pela [CIO.com](https://www.cio.com), 05/02/2025.

### Visa Research - TREASURE
**Técnica:** Transformer decoder causal treinado do zero sobre sequência de transação de pagamento - foundation model proprietário, não o padrão clássico "pega um LLM pronto e faz fine-tuning depois".
**O que fizeram:** Foundation model pra dado de transação da rede Visa (300+ bilhões de transação/ano), pra substituir múltiplos modelos especializados de ML, incluindo decisão de autorização (Stand-in Processing).
**Resultado real:** 111% de melhoria numa métrica interna de detecção de comportamento anormal sobre o sistema em produção; como provedor de embeddings pra recomendação de comerciante, 104% de melhoria média sobre baseline supervisionado.
**Fonte:** [TREASURE: The Visa Payment Foundation Model](https://arxiv.org/abs/2511.19693), Visa Research, arXiv, nov/2025 (v3 abr/2026).

**Nota de rigor deste setor:** Shift Technology + Azure OpenAI descreve "fine-tune prompts" (prompt engineering, não fine-tuning de modelo) - descartado. Inscribe (AWS Bedrock) é pipeline agentic multi-modelo via prompting - descartado. O Payments Foundation Model da Stripe (fraude/card-testing, 59%→97% de detecção) é metodologicamente parecido com o caso Visa, mas o material oficial nunca usa a palavra "fine-tuning" - fica de fora como caso principal, mas vale mencionar como candidato quase certo. TREASURE (Visa) foi incluído com a mesma ressalva registrada no próprio campo.

---

## Varejo / e-commerce

### Instacart - Query Understanding
**Técnica:** Llama-3-8B + LoRA, via destilação de um pipeline "professor" (RAG + context engineering).
**O que fizeram:** Reescreveram o motor de entendimento de busca (query de cauda longa, ex.: "algo pra ressaca de domingo" → categoria isotônico/analgésico), combinando RAG pra gerar dado de treino de alta qualidade + fine-tuning de modelo pequeno rodando em produção.
**Resultado real:** Cobertura de reescrita >95% com precisão >90%; redução de 50% nas reclamações sobre resultado ruim em query de cauda longa; latência de ~700ms pra ~300ms via merge de LoRA. Precisão do 8B afinado (96,4%) ficou muito próxima do modelo "professor" frontier (95,4%).
**Fonte:** [Building The Intent Engine](https://tech.instacart.com/building-the-intent-engine-how-instacart-is-revamping-query-understanding-with-llms-3ac8051ae7ac), Instacart Tech Blog, 21/11/2025.

### eBay - e-Llama
**Técnica:** Continued pretraining do Llama 3.1 (8B e 70B) - 1 trilhão de tokens, ~480 GPU H100, ~1 mês - seguido de instruction tuning e alinhamento com feedback humano.
**O que fizeram:** Continuaram o pré-treino numa mistura ~1:1 de dado proprietário do eBay (listagem, busca, catálogo) e dado de domínio geral, depois instruction tuning pra tarefas como geração de descrição de produto.
**Resultado real:** ~25% de melhoria em benchmark de e-commerce em inglês, ~30% em idioma não-inglês, com apenas 1% de degradação em benchmark geral (modelo 70B) - domínio ganho sem esquecimento catastrófico relevante.
**Fonte:** [Scaling Large Language Models for e-Commerce](https://innovation.ebayinc.com/stories/scaling-large-language-models-for-e-commerce-the-development-of-a-llama-based-customized-llm-for-e-commerce/), eBay Innovation Blog, 17/01/2025.

### Mercari - extração de atributo
**Técnica:** Gemma-2B-it + QLoRA, depois quantizado pra 4-bit (q4_k_m via llama.cpp) pro deploy.
**O que fizeram:** Extração de atributo estruturado dinâmico (tamanho, cor, preço original) do texto livre da descrição do anúncio, nas 20 categorias com mais listagem, em japonês e inglês - em vez de usar GPT-3.5 via API.
**Resultado real:** Superou o GPT-3.5 Turbo em BLEU score por mais de 5 pontos; modelo quantizado ficou ~95% menor que o Gemma-2B-it base; custo caiu mais de 14x comparado à API do gpt-3.5-turbo-0125.
**Fonte:** [Fine-Tuning an LLM to Extract Dynamically Specified Attributes](https://engineering.mercari.com/en/blog/entry/20240913-fine-tuning-an-llm-to-extract-dynamically-specified-attributes/), Mercari Engineering Blog, 13/09/2024.

**Nota de rigor deste setor:** Um post da Databricks cita o dataset público WANDS da Wayfair, mas o fine-tuning foi feito pela própria Databricks como demo/tutorial, sem evidência de deploy real pela Wayfair - descartado. Zalando (extração de atributo de moda) descreve solução via prompt engineering, citando fine-tuning só como possibilidade futura não implementada - descartado.

---

## Ferramentas de desenvolvimento / código

### Meta - CodeCompose
**Técnica:** Full fine-tuning do InCoder-1.3B (produção inicial) migrando pra CodeLlama-7B, com "Language Causal Masking" (LCM) próprio.
**O que fizeram:** Autocomplete de código no IDE interno da Meta, 9 linguagens, fine-tuning em código proprietário dos monorepos da Meta em vez de só dado público.
**Resultado real:** Exact match por linguagem: 48,8% Python (2,1x melhor que modelo só com dado público), 57,7% Hack (4,1x), 52,2% Flow (2,8x), 40,0% C++ (1,7x). Em produção: 16.000 devs usando, 4,5 milhões de sugestão gerada, 22% de taxa de aceitação, 8% de todo código alterado veio do CodeCompose, 91,5% de feedback positivo.
**Fonte:** [AI-Assisted Code Authoring at Scale](https://arxiv.org/abs/2305.12050), ACM PACMSE, FSE 2024.

### Replit - correção de código
**Técnica:** Full fine-tuning supervisionado do DeepSeek-Coder-Instruct-v1.5 (7B), saída em formato "Line Diffs" numerado.
**O que fizeram:** Modelo especializado em consertar automaticamente erro de diagnóstico do LSP em código Python - correção, não geração do zero.
**Resultado real:** O modelo de 7B ficou competitivo com GPT-4 e Claude 3 Opus no benchmark "Leetcode Repair Eval", e superou todos os baseline testados exceto o GPT-4-Turbo no "Replit Repair Eval" (cenário real).
**Fonte:** [Building LLMs for Code Repair](https://blog.replit.com/code-repair), Replit Blog, 02/04/2024.

### Cursor (Anysphere) - Tab
**Técnica:** Pós-treinamento via RL online (Policy Gradient), não fine-tuning supervisionado clássico - checkpoint novo a cada 1,5-2h.
**O que fizeram:** Treino contínuo do autocomplete "Tab" a partir do comportamento real de milhões de dev (aceitar/rejeitar sugestão = recompensa).
**Resultado real:** 21% menos sugestões, mas com taxa de aceitação 28% maior que o modelo anterior; mais de 400 milhões de requisição por dia.
**Fonte:** [Improving Cursor Tab with Online RL](https://cursor.com/blog/tab-rl), Cursor/Anysphere Blog, 12/09/2025.

**Nota de rigor deste setor:** Uber AutoCover (geração de teste) - o paper acadêmico original (ICSE-SEIP 2026) mostra modelo de propósito geral via prompting/multi-agente, sem fine-tuning, apesar de agregador secundário afirmar o contrário. JetBrains Mellum - o próprio post oficial confirma que NÃO é fine-tuned, é pré-treinado do zero.

---

## Mídia, conteúdo e marketing

### Roblox - Roblox Guard 1.0
**Técnica:** Instruction fine-tuning do Llama-3.1-8B-Instruct, incorporando cadeia de raciocínio (chain-of-thought), dado majoritariamente sintético.
**O que fizeram:** Modelo guardrail que avalia, em tempo real, prompt e resposta da geração de texto da plataforma (chat de personagem, conteúdo gerado), sinalizando 25 subcategorias de violação de política.
**Resultado real:** F1 de 91,9% no benchmark Aegis 1.0 (superando BingoGuard e GPT-4o), F1 de 87,3% no BeaverTails (contra 83,8% do GPT-4o), F1 de 79,6% no eval proprietário RobloxGuard-Eval (outros guardrail ficaram abaixo de 30%).
**Fonte:** [State-of-the-Art LLM Helps Safeguard Unlimited Text Generation on Roblox](https://about.roblox.com/newsroom/2025/07/roblox-guard-advancing-safety-for-llms-with-robust-guardrails), Roblox Newsroom, 22/07/2025.

### Persado - Motivation AI
**Técnica:** SFT sobre dado proprietário de campanha de marketing, seguido de RLHF usando desempenho real de campanha como recompensa (não preferência humana genérica).
**O que fizeram:** Geração de texto de marketing pra empresa regulada (banco, seguradora), sobre base de 330+ bilhões de interação de consumidor e 1+ milhão de teste A/B real.
**Resultado real:** Segundo a própria empresa: supera a melhor copy humana em 96% dos testes, gera em média 41% mais conversão, mais de US$2,5 bilhões em receita incremental atribuída (clientes incluem 7 dos 10 maiores bancos dos EUA).
**Fonte:** [How Persado Harnesses Specialized Language Models for Marketing](https://www.persado.com/articles/how-persado-harnesses-specialized-language-models-for-marketing/), Persado Blog, 16/09/2024.

### Waymark - geração de roteiro de vídeo
**Técnica:** Fine-tuning do GPT-3 (o próprio título do case da OpenAI é "Fine-tuning GPT-3").
**O que fizeram:** Geração de roteiro de comercial de TV customizado a partir da presença online do cliente (site, rede social) - few-shot prompting não era confiável o bastante pro formato exigido, daí a necessidade de fine-tuning de verdade.
**Resultado real:** Resultado qualitativo (cliente edita bem menos o roteiro gerado); nenhum número percentual duro encontrado publicamente - o ponto mais fraco deste caso.
**Fonte:** [Waymark - Fine-tuning GPT-3 to scale video creation](https://openai.com/index/waymark/), OpenAI Customer Stories.

**Nota de rigor deste setor:** Grab (moderação de conteúdo, "redução de 90% do esforço humano") atribui a métrica ao uso geral de LLM na moderação Tier 2, não especificamente a fine-tuning - o próprio texto trata fine-tuning como trabalho em andamento, resultado "promissor" sem número. Descartado por não isolar a contribuição do fine-tuning. Também checados sem sucesso: L'Oréal, Klaviyo, Duolingo, Coursera, Canva, Wix, Shutterstock.

---

## Como usar este catálogo

Cada caso aqui passou pelo mesmo filtro: fonte primária lida por inteiro (não resumo de busca), fine-tuning confirmado explicitamente (não RAG, não prompt engineering disfarçado), e métrica concreta sempre que existir. Onde a fonte é a própria empresa falando do próprio produto (a maioria dos casos aqui, é o padrão do mercado), isso está marcado, não escondido.

Três destes casos (EXL e Nubank em 6.1, Intercom em 6.3) já estão narrados. Os outros 18 são material de leitura livre: bons pra citar numa apresentação, discutir num grupo de estudo, ou simplesmente entender o tamanho real do mercado de fine-tuning fora desta disciplina.

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager

Veja também: [Bestiário do Zoo](modulo-01-decision-framework/mecanismo-estado-arte-companion.html) · [Anatomia GPU/CUDA](modulo-04-lora-e-peft/gpu-cuda-anatomia-poster.html) · [Risco de Validade de Modelo](risco-validade-modelo-companion.md) · [Setup GCP Próprio](modulo-03-fine-tuning-via-api/gcp-setup-companion.md) · [Comparação de Adapters](modulo-04-lora-e-peft/adapter-comparison-companion.md) · [Comparação de Rank](modulo-04-lora-e-peft/rank-adapter-comparison-companion.md) · [Histórico do Fine-Tuning](historico-fine-tuning-companion.md)
