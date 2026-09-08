# Companion: Fine-Tuning com Dado Regulado

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulo 2.1 (complementar ao gate de governança do Módulo 1.2)**

O gate de governança do Módulo 1.2 (`validarGovernancaDado`) checa se o dado *pode* ser tratado: base legal definida e, se for categoria sensível, DPA assinado. Ele é binário e deliberadamente raso: mascaramento de dado sensível e auditoria completa de compliance ficam pra disciplina 10, Segurança e Governança em IA. Este documento cobre o degrau técnico entre os dois: o que fazer com o dado *depois* que ele passou no gate de governança, mas *antes* de virar exemplo de treino, específico do contexto de fine-tuning, não de governança de IA em geral.

Os dois casos da Amplitude Seguros usados nesta disciplina são sintéticos, então nenhum deles expôs um dado real de verdade. Mas o desenho pedagógico foi deliberado nessa escolha, e o próprio Módulo 2.1 já narra isso: em produção, o recomendado é pseudonimizar o identificador antes do treino, o texto bruto só ficou visível aqui pra fins de demonstração. Este companion é a continuação técnica dessa frase.

**Como ler cada seção:** O que é → Quando importa → Requisitos práticos → Caso real verificado → Fontes. Mesmo padrão de rigor do cheatsheet do Módulo 1.3: todo número aqui tem fonte primária, nenhum foi assumido.

---

## 1. Higienização de PII/PHI antes do treino

**O que é:** detectar e redigir identificador pessoal (nome, CPF, RG, endereço) do texto bruto antes dele virar exemplo de treino, mantendo o dado que a tarefa realmente precisa (placa, valor, procedimento).

**Quando importa:** sempre que o dataset de fine-tuning vem de documento real de cliente, não de exemplo sintético como os desta disciplina. Rodar fine-tuning sobre PII bruto tem dois riscos distintos: o modelo pode memorizar e vazar aquele dado específico (ver seção 4), e mesmo sem vazamento, manter PII num artefato de treino (dataset, checkpoint, log) já expande a superfície de exposição regulatória do dado.

**Requisitos práticos:**
| Item | Faixa de referência |
|---|---|
| Abordagem dominante em produção | Híbrida: regex pra identificador estruturado de alta confiança (CPF, e-mail, número de apólice) + NER (Named Entity Recognition, reconhecimento de entidade nomeada: um modelo treinado pra achar nome de pessoa, organização e local em texto livre, sem depender de rótulo fixo tipo "Segurado:") pra nome em texto livre |
| Onde rodar a detecção via LLM | Localmente (modelo local via llama.cpp/Ollama/MLX), nunca mandando o PII bruto pra uma API de nuvem só pra detectar o próprio PII |
| Ferramenta de referência de mercado | Microsoft Presidio (open source): regex + NER via spaCy, 13 tipos de entidade global (mais entidades específicas por país e por domínio médico) |
| Validação de CPF brasileiro | Regex só confirma formato; validação real exige o dígito verificador (algoritmo Módulo 11 da Receita Federal) |

**Demo disponível:** [`pii-scrubbing-gate-tool.js`](pii-scrubbing-gate-tool.js) / [`pii_scrubbing_gate_tool.py`](pii_scrubbing_gate_tool.py), nesta mesma pasta. Roda de verdade contra os documentos reais do Módulo 2.1 (agora com CPF adicionado, como um caso real de seguradora traria): regex de CPF com validação real do dígito verificador via Módulo 11, e detecção de nome ancorada em rótulo (`Segurado:`/`Beneficiário:`). 11 testes automatizados, incluindo um CPF de teste publicamente conhecido (111.444.777-35) e um número de 11 dígitos com formato válido mas dígito verificador errado, pra confirmar que o gate não redige falso positivo. Limite honesto documentado no próprio demo: a âncora de rótulo não pega nome solto fora de um rótulo conhecido, isso exigiria NER de verdade.

**Caso real verificado:** Wiest et al., "Deidentifying Medical Documents with Local, Privacy-Preserving Large Language Models: The LLM-Anonymizer" (NEJM AI, 2025). Um Llama-3 70B local, rodado via llama.cpp, testado contra 250 cartas clínicas reais em alemão: 99,24% dos caracteres de PHI corretamente redigidos, 0,76% perdidos, 2,43% de falso positivo (over-redaction). É um número real, revisado por pares, no nível de caractere, não um "acima de 99%" vago de material de marketing.

**Fontes:** Wiest et al., NEJM AI, DOI 10.1056/AIdbp2400537 (preprint: medRxiv 2024.06.11.24308355); Microsoft, documentação Presidio (microsoft.github.io/presidio); Limina, "Fine-tuning LLMs: the privacy-first playbook" (getlimina.ai), citando os incidentes reais ScatterLab e Samsung como motivação; John Snow Labs, comparativo de desidentificação médica (jan/2025), testando Healthcare NLP, Azure Health Data Services, AWS Comprehend Medical, GPT-4o e Claude 3.7 Sonnet contra 48 documentos anotados por especialista.

---

## 2. Fine-tuning com privacidade diferencial (DP-SGD / DP-LoRA)

**O que é:** treinar adicionando ruído calibrado ao gradiente durante o próprio treino (DP-SGD), de forma que nenhum exemplo individual do dataset possa ser reconstruído ou confirmado a partir do modelo final, mesmo que a higienização de PII (seção 1) falhe em pegar algo. Aplicável a LoRA também (DP-LoRA), não só a full fine-tuning.

**Quando importa:** quando a higienização de PII reduz o risco mas não o zera, cenário exatamente do caso Amplitude Saúde Empresarial, dado de saúde é categoria sensível pela LGPD (Art. 5º, II) mesmo depois de qualquer scrub. DP é o mecanismo técnico pra dar uma garantia matemática de privacidade, não só uma redução heurística.

**Requisitos práticos:**
| Item | Faixa de referência |
|---|---|
| Escala comprovada em produção | VaultGemma (Google, 2025): DP-SGD escalado pra um LLM de 1B de parâmetros, nível de produção, não só experimento acadêmico |
| Unidade de privacidade recomendada | DP por usuário (amostrar por usuário, não por exemplo) supera DP por exemplo no trade-off privacidade/utilidade |
| Faixa de epsilon (ε), revisão médica jan/2026, 74 estudos | ε≈10 preserva acurácia clinicamente aceitável; ε≈1 degrada de forma acentuada |
| Custo | Ruído reduz utilidade do modelo; quanto menor o ε (mais privacidade), maior a perda de qualidade |

**Caso real verificado:** VaultGemma, Google, 2025: primeiro LLM de escala de produção (1B parâmetros) treinado do zero com DP-SGD, demonstrando que privacidade diferencial deixou de ser só viável em modelo pequeno de laboratório.

**Fontes:** VaultGemma, Google DeepMind/Google Research (2025); "Mind the Privacy Unit!" (OpenReview, DP por usuário vs. por exemplo); revisão sistemática de DP em modelo de linguagem médico (jan/2026, 74 estudos, faixa de ε).

---

## 3. Fine-tuning federado

**O que é:** treinar sem centralizar o dado bruto num único lugar; cada parte (ex.: cada seguradora, cada hospital) treina um adaptador LoRA localmente sobre o próprio dado, e só o adaptador (não o dado) é compartilhado ou agregado.

**Quando importa:** quando LGPD/GDPR/HIPAA impedem legalmente centralizar o dado de origem, cenário típico de consórcio entre seguradoras ou rede de clínicas parceiras, não do piloto de uma empresa só que esta disciplina constrói. Levantamento de 2025 descreve LoRA federado como "o único mecanismo legal e operacionalmente viável" pra adaptar um LLM a registro clínico/financeiro real quando a regulação impede centralizar.

**Requisitos práticos:**
| Item | Faixa de referência |
|---|---|
| O que se compartilha | Só o adaptador LoRA (poucos MB), nunca o dataset bruto |
| Cenário típico | Múltiplas organizações, mesma vertical, dado que não pode sair da própria infraestrutura |
| Não é o caso desta disciplina | O piloto Amplitude Seguros é de uma empresa só, com dado que já passou pelo gate de governança do Módulo 1.2; federação vira relevante quando o dado é de terceiro que a Amplitude não pode centralizar |

**Caso real verificado:** "Flow of Knowledge" (2025) documenta LoRA federado aplicado a registro clínico real, motivado exatamente pela barreira legal de centralização.

**Fontes:** Levantamento de fine-tuning federado (2025); "Flow of Knowledge" (2025).

---

## 4. Risco de memorização e extração

**O que é:** um modelo fine-tunado sobre um dataset pequeno e de alto valor pode memorizar exemplos específicos, e um atacante com acesso ao modelo (via prompt cuidadosamente desenhado) pode extrair de volta um exemplo de treino específico, inclusive PII que passou despercebida pela higienização.

**Quando importa:** quanto menor e mais específico o dataset (exatamente o perfil dos pilotos desta disciplina, dezenas a centenas de exemplos, não milhões), maior o risco relativo de memorização por exemplo individual. É a razão técnica de fundo por trás de rodar a higienização da seção 1 mesmo quando o dado "parece" já estar limpo.

**Requisitos práticos:**
| Item | Faixa de referência |
|---|---|
| Vetor de ataque documentado | Inferência de associação (membership inference) via padrão de atenção do modelo |
| Defesa emergente | Defesas de extração com garantia formal, ainda pesquisa ativa, não padrão de mercado maduro |
| Mitigação prática disponível hoje | Higienização de PII (seção 1) + DP-SGD/DP-LoRA (seção 2) reduzem a superfície, nenhuma das duas zera o risco sozinha |

**Fontes:** Defesas de extração com garantia formal (2026); inferência de associação via atenção (2026).

---

## 5. LGPD e o cenário regulatório brasileiro

O que conecta as quatro seções acima ao caso Amplitude Seguros: a ANPD tem agenda de fiscalização 2026-2027 nomeando sistema de IA que processa dado sensível (saúde, financeiro/comportamental) como um dos quatro eixos prioritários, com cerca de vinte ações de fiscalização planejadas. A Nota Técnica 12/2025 da ANPD, consolidação das contribuições recebidas na Tomada de Subsídios sobre IA, sinaliza a direção regulatória em privacidade diferencial e anonimização como mitigação de RIPD (Relatório de Impacto à Proteção de Dados) em projeto de IA, mas o próprio documento registra divergência entre os participantes sobre se isso deveria ser obrigatório ou só boa prática, e não cria obrigação legal direta por si só.

O gate de governança do Módulo 1.2 já verifica se o piloto *pode* nascer, do ponto de vista de base legal e DPA. Este companion cobre o que fazer tecnicamente depois que ele nasceu: higienizar antes do treino (seção 1), considerar privacidade diferencial quando a categoria é sensível (seção 2), federar quando o dado não pode ser centralizado (seção 3), e não assumir que higienização sozinha zera o risco de memorização (seção 4).

**Fontes:** ANPD, agenda de fiscalização 2026-2027; ANPD, Nota Técnica 12/2025.

**Material extra relacionado:** `de-para-bibliotecas-de-mercado.md` (na mesma pasta) cita o Presidio como a referência de mercado pra higienização de PII, com uma seção dedicada comparando esta técnica contra o que o mercado oferece pronto.

---

*Ahirton Lopes · Fine-Tuning Toolkit, UNIPDS: Processamento de Dados e Fine-Tuning de Modelos*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
