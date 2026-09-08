# Cheatsheet Companion: Tipos de Fine-Tuning
> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulo 1.3**

O slide do vídeo mostra um card resumido por tipo. Este documento é o companion completo: cruza o caso real verificado de cada tipo com guias de mercado (OpenAI, Hugging Face, Google Vertex AI) e comparativos de custo/infraestrutura, pra você ter requisito prático de dado, hardware e hiperparâmetro na mão, não só o conceito.

**Como ler cada seção:** O que é → Quando usar (best practice do mercado) → Requisitos práticos → Caso real verificado → Fontes. Nenhum número aqui foi assumido: todo case e toda faixa numérica tem fonte primária ou guia oficial por trás.

> **Versão visual:** as seis primeiras técnicas abaixo, com o mesmo caso real de cada uma, mais os modelos abertos recomendados pra treinar em 2026, estão reunidas como pôster de campo em [`fine-tuning-zoo-poster.png`](fine-tuning-zoo-poster.png), na mesma pasta deste arquivo; inclui também a chave de decisão do Módulo 1.1/1.2 (vale a pena fazer fine-tuning ou não). A sétima técnica (GRPO/RFT) é a mais recente e ainda não entrou no pôster: fica documentada aqui e no demo rodável da seção 7.
>
> **Dossiê completo:** pra quem quer o mecanismo teórico de cada técnica (por que funciona, não só o que é) com fontes acadêmicas verificadas, o pôster tem uma versão interativa com um dossiê de pesquisa por espécie: [`mecanismo-estado-arte-companion.html`](mecanismo-estado-arte-companion.html) ("Bestiário do Zoo"), na mesma pasta.

> **Sobre os valores de custo e preço de GPU citados neste documento:** são a faixa de mercado observada na época desta gravação (ago/2026) - preço de GPU cloud e de hardware de consumidor muda rápido. Antes de usar esses números pra decidir orçamento de verdade, confira o preço vigente (ex.: [Vast.ai](https://vast.ai/pricing/gpu), [RunPod](https://www.runpod.io/pricing)) em vez de assumir que o valor aqui continua igual.

---

## 1. Full Fine-Tuning

**O que é:** todos os parâmetros do modelo são atualizados durante o treino. É o approach mais caro e também o de maior teto de qualidade, quando há orçamento e dado pra sustentar.

**Quando usar (best practice de mercado):** quando o domínio do seu caso está muito distante do que o modelo já viu no pré-treino, e você tem escala (orçamento + dado + time de ML) pra sustentar o custo. Pra tarefas simples, LoRA/QLoRA já cobrem o ganho de qualidade com fração do custo: full fine-tuning só se paga quando a diferença de qualidade justifica a diferença de investimento.

**Requisitos práticos:**
| Item | Faixa de referência |
|---|---|
| VRAM pra treinar um modelo de 7B | ~100-120GB (ex.: multi-GPU H100) |
| Custo de infraestrutura | Ordem de US$ 50 mil em GPUs H100, ou aluguel de cluster equivalente |
| Tempo de treino | Dias a semanas, setup multi-node |
| Dado mínimo recomendado (OpenAI) | 50 exemplos bem elaborados pra começar a ver ganho; tarefas simples (classificação/extração) na faixa de 50-100; tarefas complexas (tradução/sumarização) de 5 mil a 200 mil+ |

**Caso real verificado:** GPT-3 → Codex (OpenAI, 2021). Fine-tune completo (todos os parâmetros) em 159GB de código Python público do GitHub. Virou a base do GitHub Copilot.

**Fontes:** OpenAI, "Evaluating Large Language Models Trained on Code" (arXiv 2107.03374); OpenAI, guia oficial "Fine-tuning best practices" (platform.openai.com); comparativo de custo/VRAM: Introl, "Fine-Tuning Infrastructure: LoRA, QLoRA, and PEFT at Scale" (2025).

---

## 2. LoRA (Low-Rank Adaptation)

**O que é:** em vez de atualizar todos os parâmetros, LoRA congela o modelo base e treina só um par de matrizes de baixo posto (adaptadores) inseridas nas camadas de atenção. Uma fração pequena dos parâmetros originais.

**Quando usar (best practice de mercado):** é o default de produção pra maioria das tarefas. Na prática, fica a poucos pontos percentuais de qualidade do full fine-tuning na maioria das tarefas de instrução/saída estruturada, com custo muito menor. Segundo a documentação oficial do Hugging Face PEFT, aplique o LoRA no mínimo nas camadas de atenção (`q_proj`/`v_proj`); `alpha` igual ao `rank` é uma escolha conservadora segura, e não é recomendado deixar `alpha` muito menor que o `rank` (suprime demais o ajuste).

**Requisitos práticos:**
| Item | Faixa de referência |
|---|---|
| VRAM pra treinar um modelo de 7B | ~16-24GB (cabe numa GPU só, ex. A100) |
| Custo de infraestrutura | GPU cloud na faixa de US$ 0,40-0,80/hora (consumer) até US$ 2,50-4,00/hora (H100) |
| Tempo de treino | Ordem de horas (ex.: ~6h pra 7B numa A100) |
| Hiperparâmetro de referência | `rank` e `alpha` proporcionais (ex. `alpha = rank`); alvo mínimo: camadas de atenção |

**Caso real verificado:** Checkr + Predibase. Llama-3-8B-Instruct com adaptadores LoRA pra classificar registros de background check, atingindo 90% de acurácia nos 2% de casos mais difíceis (acurácia geral do modelo ficou em torno de 97%), 5x mais barato e 30x mais rápido que a implementação anterior com GPT-4.

**Variante 2026: DoRA (Weight-Decomposed LoRA).** Decompõe a atualização em magnitude e direção em vez de só direção, e é tratado como sucessor natural do LoRA puro (Liu et al., arXiv 2402.09353), com suporte nativo no `mlx_lm.lora` (`--fine-tune-type dora`) e no Hugging Face PEFT. Não é sempre melhor: no treino real rank 8 desta disciplina (Módulo 4.3), DoRA e LoRA empataram exatamente (val loss 0,895 vs. 0,895, 20 iterações), com DoRA usando ~7,5% mais parâmetro treinável. O ganho relatado na literatura aparece mais em tarefas complexas e treinos mais longos, não é garantia universal. Comparação completa no Módulo 4.3.

**Fontes:** Predibase, case study oficial (predibase.com); Hugging Face, documentação PEFT ("LoRA methods", huggingface.co/docs/peft); comparativo de custo/VRAM: Introl (2025); Liu et al., "DoRA: Weight-Decomposed Low-Rank Adaptation" (arXiv 2402.09353).

---

## 3. QLoRA (Quantized LoRA)

**O que é:** LoRA aplicado sobre um modelo base quantizado em 4-bit, reduzindo ainda mais o consumo de memória e permitindo treinar modelos grandes em hardware de consumidor.

**Quando usar (best practice de mercado):** é a opção pra quem não tem orçamento de datacenter, permitindo treinar modelos de dezenas de bilhões de parâmetros numa única GPU de consumidor (ex.: RTX 4090, ~US$ 2.500 em ago/2026 - preço bem acima do MSRP de lançamento por escassez e demanda de IA, confira o valor atual antes de orçar) em vez de um cluster de H100. QLoRA reduz significativamente o consumo de memória de GPU frente ao LoRA padrão, mantendo qualidade comparável ao full fine-tuning de 16-bit; a redução exata de memória e o gap de qualidade variam por tarefa e benchmark, não é garantia universal.

**Requisitos práticos:**
| Item | Faixa de referência |
|---|---|
| VRAM pra treinar um modelo de 7B | ~10-14GB (cabe numa GPU de consumidor) |
| Custo de infraestrutura | GPU de consumidor (ex.: RTX 4090, ~US$ 1.500) em vez de datacenter |
| Tempo de treino | Ordem de horas (o case Guanaco: 24h numa única GPU de 48GB, pra 65B) |
| Quantização | 4-bit (NF4), adaptadores LoRA sobre o modelo congelado |

**Caso real verificado:** Guanaco (Universidade de Washington, 2023). Modelo de 65B treinado numa única GPU de 48GB em 24 horas, atingindo 99,3% da performance do ChatGPT no benchmark Vicuna.

**Fontes:** Dettmers et al., "QLoRA: Efficient Finetuning of Quantized LLMs" (arXiv 2305.14314, NeurIPS 2023); comparativo de custo/VRAM: Introl (2025).

---

## 4. Instruction Tuning

**O que é:** ajuste supervisionado do modelo pra seguir instruções em linguagem natural descrevendo a tarefa, em vez de depender só de exemplos implícitos no prompt.

**Quando usar (best practice de mercado):** quando você precisa que o modelo generalize pra instruções nunca vistas no treino, não só repetir um padrão fixo. A literatura de mercado (Ruder, pesquisa acadêmica de mistura de tarefas) confirma dois pontos práticos: treinar num conjunto pequeno e de alta qualidade supera treinar num conjunto grande e ruidoso; e balancear a mistura de tipos de tarefa (chat, código, raciocínio, extração) importa tanto quanto a diversidade dentro de cada tipo.

**Requisitos práticos:**
| Item | Faixa de referência |
|---|---|
| Diversidade de tarefas | Múltiplas categorias (ex.: chat, código, raciocínio, extração), balanceadas, não só volume |
| Qualidade vs. quantidade | Um conjunto pequeno e limpo supera um conjunto grande e ruidoso |
| Dataset (referência Vertex AI) | Começar por ~100 exemplos representativos da tarefa real, escalar se necessário |

**Caso real verificado:** FLAN (Google, 2021). Modelo de 137B ajustado via instrução em mais de 60 tarefas de PLN, superando o GPT-3 175B zero-shot em 20 de 25 tarefas avaliadas.

**Fontes:** Wei et al., "Finetuned Language Models Are Zero-Shot Learners" (arXiv 2109.01652); Sebastian Ruder, "An Overview of Instruction Tuning Data" (ruder.io); Google Cloud, guia oficial de supervised fine-tuning para Gemini (docs.cloud.google.com/vertex-ai).

---

## 5. RLHF e DPO (Alinhamento por Preferência)

**O que é:** ajuste do modelo com base em preferência humana entre respostas, não em um único "gabarito" fixo. **RLHF** (Reinforcement Learning from Human Feedback) treina um modelo de recompensa separado e depois otimiza o modelo principal via reinforcement learning (tipicamente PPO). **DPO** (Direct Preference Optimization) pula o modelo de recompensa e otimiza direto sobre pares de preferência (resposta escolhida vs. rejeitada).

**Quando usar (best practice de mercado):** escolha **DPO** quando você já tem um conjunto fixo de pares de preferência de boa qualidade, orçamento de computação modesto e não quer manter infraestrutura de RL. É a opção mais simples e reproduzível pra times que não têm esse know-how em casa. Escolha **RLHF** quando a fidelidade do sinal de recompensa importa mais do que a simplicidade, e há orçamento pra manter o pipeline de reward model + RL. A recomendação de mercado é decidir com base em orçamento, volume de dado de preferência e escala do modelo, não em qual método está mais na moda.

**Requisitos práticos:**
| Item | RLHF | DPO |
|---|---|---|
| Complexidade de infraestrutura | Alta (reward model + RL/PPO) | Baixa (otimização direta) |
| Dado necessário | Pares de preferência + processo de coleta contínuo | Conjunto fixo de pares de preferência |
| Estabilidade de treino | Mais sensível a hiperparâmetro | Mais estável e reproduzível |

**Caso real verificado:** InstructGPT (OpenAI, 2022, RLHF): modelo de 1,3B teve suas respostas preferidas pelos avaliadores humanos sobre o GPT-3 de 175B na maioria dos casos testados. Zephyr-7B (Hugging Face, DPO): Mistral-7B ajustado com SFT seguido de DPO sobre os datasets UltraChat/UltraFeedback, igualando a qualidade de modelos de chat bem maiores.

**Fontes:** Ouyang et al., "Training Language Models to Follow Instructions with Human Feedback" (arXiv 2203.02155); Hugging Face, model card Zephyr-7B-beta e blog "Preference Tuning LLMs with Direct Preference Optimization Methods" (huggingface.co); comparativo de trade-offs: Mercor, "DPO vs RLHF: Comparison and When to Use Each".

**Variante 2026: RLAIF / Constitutional AI.** Em vez de um humano rotular cada par de preferência, o próprio modelo se autocritica e revisa a resposta contra um conjunto escrito de princípios (a "constituição"), e depois um segundo modelo julga pares das próprias respostas pra gerar o dataset de preferência que treina o reward model: só a constituição é escrita por humano, não cada rótulo (Bai et al., Anthropic, "Constitutional AI: Harmlessness from AI Feedback", arXiv 2212.08073). Custo de rotulagem cai bem abaixo do RLHF humano: Lee et al. (Google DeepMind, arXiv 2309.00267) mediram US$ 0,06 por exemplo rotulado por IA contra US$ 0,67 por exemplo rotulado por humano, mais de dez vezes mais barato. Não é técnica de nicho: é como os modelos Claude são alinhados, e o relatório técnico do Gemini 2.5 (arXiv 2507.06261) cita "recompensas generativas baseadas em modelo" inspiradas em Constitutional AI no próprio pós-treino de segurança, ainda que sem usar o nome RLAIF.

**Fontes adicionais (RLAIF):** Bai et al., Anthropic (arXiv 2212.08073); Lee et al., Google DeepMind, "RLAIF vs. RLHF" (arXiv 2309.00267); Google DeepMind, relatório técnico Gemini 2.5 (arXiv 2507.06261).

---

## 6. Distillation (Destilação de Conhecimento)

**O que é:** um modelo menor (aluno) aprende a imitar o comportamento de um modelo maior (professor), geralmente treinando sobre exemplos gerados pelo próprio professor.

**Quando usar (best practice de mercado):** quando você precisa da qualidade de um modelo grande mas do custo de inferência de um modelo pequeno, típico em produção, onde o custo por chamada importa mais que espremer o último ponto percentual de qualidade. Um ponto prático de pesquisa: quando a diferença de tamanho entre professor e aluno é grande (no experimento de referência do paper, um salto de ~14x em profundidade entre professor e aluno), destilação progressiva por um modelo intermediário (teacher assistant) funciona melhor do que ir direto do gigante pro pequeno, já que sem isso o aluno fica pequeno demais pra absorver o conhecimento do professor de uma vez.

**Requisitos práticos:**
| Item | Faixa de referência |
|---|---|
| Proporção professor/aluno | Acima de ~10x de diferença, considerar destilação progressiva (modelo intermediário) |
| Dado de destilação | Exemplos gerados pelo professor sobre dado do domínio-alvo tendem a superar dado genérico |
| Uso em produção | Reduz custo de inferência mantendo boa parte da qualidade do professor |

**Caso real verificado:** DeepSeek-R1-Distill (DeepSeek-AI, jan/2025). 800 mil exemplos de treinamento (cerca de 600 mil de raciocínio, 200 mil não relacionados a raciocínio) gerados pelo DeepSeek-R1 destilados em modelos densos Qwen2.5/Llama3, de 1,5B a 70B de parâmetros, superando baselines maiores em tarefas de raciocínio.

**Fontes:** DeepSeek-AI, "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning", arXiv 2501.12948; model cards da série DeepSeek-R1-Distill (Hugging Face); prática de proporção professor/aluno: Mirzadeh et al., "Improved Knowledge Distillation via Teacher Assistant" (arXiv 1902.03393, AAAI 2020).

---

## 7. GRPO e RFT (Reinforcement Fine-Tuning com Recompensa Verificável)

**O que é:** em vez de treinar sobre uma resposta certa fixa (SFT) ou sobre um par de preferência (RLHF/DPO), o modelo gera várias respostas candidatas pra mesma pergunta, cada uma é pontuada por uma função de recompensa mecanicamente checável (resposta de matemática bate com o gabarito, código passa nos testes, JSON bate o schema), e o treino reforça as candidatas com nota acima da média do grupo e penaliza as abaixo. **GRPO** (Group Relative Policy Optimization, Shao et al., DeepSeekMath, arXiv 2402.03300) é o algoritmo aberto por trás disso: amostra um grupo de G respostas, calcula a vantagem relativa ao grupo `A_i = (r_i - média(r)) / desvio_padrão(r)`, e dispensa o modelo de valor (critic) separado que o PPO clássico precisa. **RFT** (Reinforcement Fine-Tuning) é o nome comercial da OpenAI pra a mesma ideia como API gerenciada: você define um "grader" (`score_model`, `string_check`, `python` ou `multi`), e o backend cuida da amostragem e da atualização, sem expor o algoritmo por baixo.

**Quando usar (best practice de mercado):** exige uma recompensa verificável de verdade, matemática, geração de código com testes, extração estruturada com schema rígido, uso de ferramenta com resultado checável. Não serve pra tarefas onde "qualidade" é subjetiva (tom, estilo): aí RLHF/DPO seguem sendo a opção certa. É a fronteira mais recente das sete técnicas deste cheatsheet: exige bem mais infraestrutura de amostragem (várias gerações por prompt, não uma) do que SFT ou DPO, e por isso normalmente entra depois que SFT/LoRA já esgotaram o ganho disponível, não como primeira tentativa.

**Requisitos práticos:**
| Item | Faixa de referência |
|---|---|
| Recompensa | Tem que ser mecanicamente verificável (gabarito, testes, schema), não um "achismo" de qualidade |
| Tamanho do grupo (G) | DeepSeekMath usa G=64; grupos pequenos (G baixo) têm mais risco de "empatar" e a vantagem zerar pra todo mundo |
| Infraestrutura | Múltiplas gerações por prompt + função de recompensa executável; RFT (OpenAI) terceiriza isso via grader gerenciado |
| Limite conhecido | Grupo "unânime" (todo mundo acerta ou todo mundo erra igual) produz vantagem zero e nenhum sinal de aprendizado nessa rodada (DAPO, Yu et al., arXiv 2503.14476, propõe descartar e re-amostrar) |

**Caso real verificado:** DeepSeek-R1-Zero (DeepSeek-AI, arXiv 2501.12948) foi treinado com GRPO em larga escala direto sobre o DeepSeek-V3-Base, **sem nenhuma etapa de SFT**, usando só recompensa baseada em regra (acerto verificável + formato). O DeepSeek-R1 lançado (o modelo distilado citado na seção 6 acima) parte desse mesmo motor de RL, mas com um pequeno SFT de "cold-start" antes, pra corrigir legibilidade.

**Demo disponível:** [`grpo-verifiable-reward-demo.js`](grpo-verifiable-reward-demo.js) / [`grpo_verifiable_reward_demo.py`](grpo_verifiable_reward_demo.py), nesta mesma pasta. Roda de verdade contra um modelo local via Ollama: amostra um grupo real de respostas pra uma extração de dados da Amplitude Seguros, aplica a recompensa verificável e calcula a vantagem relativa ao grupo, sem fazer o passo de atualização de peso (fora de escopo de um demo pedagógico). Numa rodada real capturada com este script, o grupo inteiro (G=6) empatou em recompensa 0,83 (todos preservaram o mesmo ruído de OCR num campo): um grupo degenerado de verdade, exatamente o caso que o DAPO documenta, não um erro do script.

**Fontes:** Shao et al., "DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models" (arXiv 2402.03300); DeepSeek-AI, "DeepSeek-R1" (arXiv 2501.12948); OpenAI, guia oficial "Reinforcement fine-tuning" (platform.openai.com); Yu et al., "DAPO: An Open-Source LLM Reinforcement Learning System at Scale" (arXiv 2503.14476).

---

## Tabela comparativa rápida

| Tipo | Parâmetros afetados | Hardware típico (modelo 7B) | Melhor pra |
|---|---|---|---|
| Full Fine-Tuning | 100% | ~100-120GB VRAM, multi-GPU | Domínio muito distante do pré-treino, orçamento alto |
| LoRA | Fração (adaptadores) | ~16-24GB VRAM, 1 GPU | Default de produção pra maioria das tarefas |
| QLoRA | Fração (sobre base 4-bit) | ~10-14GB VRAM, GPU de consumidor | Orçamento apertado, hardware limitado |
| Instruction Tuning | Depende do método base (full ou LoRA) | Depende do método base | Generalizar pra instruções nunca vistas |
| RLHF / DPO | Depende do método base | Depende do método base + infra de preferência | Alinhar tom/comportamento à preferência humana |
| Distillation | Modelo aluno inteiro (menor) | Depende do tamanho do aluno, não do professor | Reduzir custo de inferência em produção |
| GRPO / RFT | Depende do método base + infra de amostragem em grupo | Depende do método base + várias gerações por prompt | Tarefa com recompensa verificável (matemática, código, schema rígido) |

## Risco operacional: o provedor escolhido ainda vai existir?

Não é um número, é um fato que qualquer decisão de fine-tuning deveria checar antes de comprometer orçamento: o provedor self-serve que você escolher hoje pode simplesmente parar de oferecer o serviço amanhã. Não é hipótese: dois dos principais provedores de fine-tuning self-serve do mercado já saíram ou estão saindo:

| Provedor | Status | O que aconteceu |
|---|---|---|
| OpenAI self-serve (`platform.openai.com`) | Descontinuando | Orgs novas já bloqueadas pra criar job desde 7/mai/2026; quem não usa há 60 dias perde acesso em 2/jul/2026; fecha pra todo mundo em 6/jan/2027. |
| Google AI Studio / Gemini API | Morto | Fine-tuning descontinuado desde maio/2025. Gemini 1.5 Flash-001 foi o último modelo suportado. |

**Fontes:** `developers.openai.com/api/docs/deprecations`; `ai.google.dev/gemini-api/docs/model-tuning`.

Isso não muda a decisão de SE fine-tuning vale a pena (o framework das 4 perguntas + governança continua o mesmo), mas muda ONDE treinar. Os Módulos 3 e 4 desta disciplina já escolhem provedores vivos e testados de ponta a ponta (Vertex AI e MLX-LM local), e o Módulo 3 abre explicando essa mudança de mercado antes de qualquer conteúdo técnico.

## Risco de obsolescência: mesmo que o provedor sobreviva, seu modelo pode não

Continuidade do provedor é só metade do risco operacional. A outra metade não depende de nenhuma empresa sair do mercado: o modelo de fronteira melhora mais rápido que o seu fine-tuning específico, e o investimento que parecia sólido perde a vantagem competitiva sem nenhum aviso.

Caso real, com arco completo documentado, a Harvey, startup de inteligência artificial jurídica:

| Quando | O que aconteceu |
|---|---|
| 2023 | A Harvey fine-tunou um modelo customizado em parceria com a OpenAI. Em comparação lado a lado com advogados de grandes escritórios, o modelo fine-tunado foi preferido ao GPT-4 (o modelo de fronteira da época) em 97% dos casos. |
| 2025 | Testado no BigLaw Bench (benchmark interno de raciocínio jurídico da Harvey) contra os modelos de fronteira mais recentes. Resultado: sete modelos genéricos, sem nenhum fine-tuning jurídico, já tinham superado o modelo customizado original nesse benchmark. |
| jun/2026 | A Harvey re-treinou (parceria com a Applied Compute, modelo GLM-5.1) e recuperou a liderança, desta vez no Legal Agent Benchmark (benchmark novo, agentic/longo-horizonte, mais de 1.250 tarefas em 24 áreas do direito), superando GPT-5.5 e Opus 4.8 Max, com pipeline de avaliação 5x mais barato que o da OpenAI e 15x mais barato que o da Anthropic. |
| ago/2026 | A Harvey deu mais um salto, dessa vez trocando de abordagem inteira: lançou o Tenet, não outro fine-tuning fechado com a OpenAI, mas um modelo pós-treinado (com a Fireworks AI) sobre o Kimi K3, de peso aberto, da Moonshot AI, completando quase o dobro das tarefas do benchmark jurídico (82% de melhoria na taxa all-pass do LAB test set) que o Kimi K3 base sozinho, ficando em 1º lugar em contratos e 2º geral. |

**Fontes:** OpenAI, "Customizing models for legal professionals" (`openai.com/index/harvey`); Harvey, "Expanding Harvey's Model Offerings" (`harvey.ai/blog/expanding-harveys-model-offerings`, 13/mai/2025); Harvey, "Introducing Harvey's Legal Agent Benchmark" (`harvey.ai/blog/introducing-harveys-legal-agent-benchmark`, 6/mai/2026); Applied Compute, case study Harvey (`appliedcompute.com/case-studies/harvey`, jun/2026); Harvey, "Harvey Tenet Research Preview" (`harvey.ai/blog/post-training-update-harvey-tenet`, ago/2026); South China Morning Post, "OpenAI-backed legal tech firm pivots to Chinese Kimi K3 open-weight model" (scmp.com, ago/2026).

A lição não é que fine-tuning parou de valer a pena: em 2023, e de novo em 2026, ele venceu. A lição é que a decisão do framework de quatro perguntas não é permanente. Um "sim, vale a pena" hoje pode virar "não, o modelo genérico já alcançou" em dois anos, exatamente como aconteceu com a Harvey entre 2023 e 2025. Reavaliar periodicamente, como o Módulo 3 desta disciplina mostra na prática com o caso Saúde Empresarial nove meses depois, não é exceção: é parte do processo.

## Seu caso: qual tipo se aplica?

| Pergunta | Sua resposta |
|---|---|
| Seu domínio é muito distante do que modelos genéricos já viram? | |
| Você tem orçamento pra treinar em datacenter, ou só GPU de consumidor/cloud barato? | |
| Você precisa que o modelo generalize pra instruções novas, ou só repita um padrão fixo? | |
| Você tem pares de preferência (resposta melhor vs. pior), ou só exemplos de resposta certa? | |
| Custo de inferência em produção é uma restrição forte? | |

## Como usar na atividade prática

1. Releia os três casos da Amplitude Seguros aplicados nos vídeos (Auto, Saúde Empresarial e Atendimento ao Cliente) e identifique: qual tipo de fine-tuning desta lista melhor se encaixaria em cada um, considerando volume de dado e orçamento.
2. Aplique a tabela "Seu caso" acima à sua própria tarefa real de trabalho.
3. Guarde este documento: os Módulos 3 e 4 desta disciplina aprofundam, respectivamente, fine-tuning via API gerenciada (Vertex AI) e LoRA/PEFT local. Este cheatsheet é o mapa de referência pra saber onde cada um se encaixa.

---

*Ahirton Lopes · Fine-Tuning Toolkit, UNIPDS: Processamento de Dados e Fine-Tuning de Modelos*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
