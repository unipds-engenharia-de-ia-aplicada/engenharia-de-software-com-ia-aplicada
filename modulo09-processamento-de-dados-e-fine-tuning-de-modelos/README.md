# 🎛️ Processamento de Dados e Fine-Tuning de Modelos

Este repositório centraliza os prompts, ferramentas, dados e atividades desenvolvidos durante a disciplina de **Processamento de Dados e Fine-Tuning de Modelos**. Ao longo de 6 módulos, construímos o ciclo completo de fine-tuning sobre um caso único: a **Amplitude Seguros**, seguradora fictícia com linhas de Auto e Saúde Empresarial, indo da decisão de "vale a pena fazer fine-tuning?" (framework de 4 perguntas + AHP + NPV) até um modelo customizado real, treinado, avaliado e documentado.

**Professor:** [Dr. José Ahirton Batista Lopes Filho](https://github.com/ahirtonlopes)

---

## 📂 Estrutura do Repositório

Cada módulo tem sua pasta com os artefatos usados nas demos dos vídeos: ferramentas executáveis, dados de referência e a atividade prática (PDF).

```bash
.
├── modulo-01-decision-framework/    # Framework de 4 perguntas, AHP, NPV, cheatsheet dos 6 tipos de fine-tuning, pôster "zoo" das técnicas
├── modulo-02-preparacao-datasets/   # Extração OCR, schema JSONL, deduplicação (MinHash+LSH), balanceamento, comparativo OCR vs. LLM multimodal
├── modulo-03-fine-tuning-via-api/   # Upload, hiperparâmetros, automação, versionamento (Vertex AI)
├── modulo-04-lora-e-peft/           # LoRA/PEFT, treino local (MLX), trade-offs rank vs. desempenho, análise de curva de convergência
├── modulo-05-avaliacao-modelos/     # Harness de avaliação, A/B, teste de estresse, veredito de escala
└── modulo-06-projeto-final/         # Capstone: dataset de produção escalado, protótipo, decisões de arquitetura, guias de reavaliação e geração sintética
```

## 💳 Antes de rodar: a API é paga, e a versão do modelo muda

As ferramentas que chamam a Vertex AI/Gemini de verdade (a maioria dos módulos 2 a 6) fazem chamada real e paga -- não é simulação nem mock. Dois avisos práticos antes de rodar por conta própria:

- **Custo real, mas baixo**: os jobs de fine-tuning desta disciplina custaram entre R$0,86 e R$41,40 cada, e as baterias de teste de avaliação giram em torno de R$1-2, tudo conferido no billing real do Google Cloud (ver `decisoes-de-arquitetura.md`, Módulo 6). Ainda assim, é preciso conta Google Cloud com faturamento ativado e cartão cadastrado (a autorização inicial é só verificação, não cobrança automática do que você não usar). Contas novas costumam vir com crédito de avaliação (na época desta atualização, US$300 por 90 dias) -- mas o valor, o prazo, e principalmente **as exclusões pra serviços de IA generativa mudam com frequência e não são as mesmas pra todo produto de IA do Google** (ex.: a documentação oficial já exclui explicitamente "Gemini API in AI Studio" desse crédito, mesmo sendo Google). Não assuma que o crédito cobre automaticamente o fine-tuning via Vertex AI: confira o status vigente e as exclusões atuais em [cloud.google.com/free](https://cloud.google.com/free) antes de rodar, e trate o pagamento próprio como cenário real, não exceção.
- **Versão do modelo muda**: os nomes de modelo citados no código (`gemini-2.5-flash`, `gemini-4-e2b`, etc.) valiam no momento da gravação (ago-set/2026). Provedor gerenciado aposenta versão com aviso prévio -- confira `risco-validade-modelo-companion.md` (raiz deste repositório) antes de rodar, pra saber se a versão citada ainda está disponível e qual constante trocar no código se não estiver.
- **Alternativa sem custo de API nenhum**: os módulos 4, 5.4 e 6.2 têm caminho 100% local (MLX, Apple Silicon), sem nenhuma chamada paga -- ver `local-lora-training-tool.js`/`chamar_modelo_local.py`, e os companions Colab (GPU T4 gratuita) pra quem não tem Mac Apple Silicon.

## 🔑 Antes de rodar: cada aluno configura os próprios recursos

Vários scripts desta disciplina precisam de um projeto GCP, endpoint ou job de fine-tuning configurados via variável de ambiente. Sem essas variáveis definidas, o script para com um erro claro explicando o que falta -- nunca usa um valor padrão de terceiros.

**Passo 0, uma vez só:** siga `gcp-setup-companion.md` (raiz do Módulo 3) pra criar seu projeto GCP e habilitar a Vertex AI.

| Você já tem... | Defina | Usado em |
|---|---|---|
| Um projeto GCP com Vertex AI habilitado | `GCP_PROJECT_ID` | M2 (extração multimodal), M5.2 |
| Um job de fine-tuning rodado (Missão Prática #3) | `TUNING_JOB_NAME` | M3 (upload/tracking, automation, hyperparameter/monitoring, versioning) |
| Um endpoint publicado do seu modelo (200 exemplos, M3.2) | `ENDPOINT_MODULO32` | M5.1 (harness, base de M5.2-5.4), M6.3 |
| Um endpoint publicado do seu modelo escalado (3.000 exemplos, M6.3) | `ENDPOINT_MODULO63` | M6.3 |

Exemplo de uso:
```bash
export GCP_PROJECT_ID=meu-projeto-aqui
export ENDPOINT_MODULO32=projects/meu-projeto-aqui/locations/us-central1/endpoints/1234567890
node model-evaluation-harness-tool.js
```

**Não tem Mac Apple Silicon, ou quer rodar sem custo de nuvem nenhum?** Os módulos 4, 5.4 e 6.2 têm caminho 100% local: `local-lora-training-tool.js`/`.py` (M4.2) treina de verdade via MLX (Apple Silicon) -- pra quem não tem Mac, `colab-lora-training-notebook.ipynb` faz o mesmo treino via Hugging Face na GPU T4 gratuita do Colab (guia completo em `colab-lora-training-companion.md`), com o mesmo caminho replicado pra avaliação (`colab-model-evaluation-notebook.ipynb`, M5.4) e pro assistente do capstone (`colab-local-model-notebook.ipynb`, M6.2).

## 📚 Companions da disciplina inteira

Quatro arquivos na raiz deste repositório não pertencem a um módulo só -- valem a leitura em qualquer ponto do curso:

| Arquivo | O que é |
|---------|---------|
| `casos-de-mercado-fine-tuning-companion.md` | 21 casos reais de empresas usando fine-tuning em produção hoje, em 7 setores |
| `disponibilidade-fine-tuning-provedores-companion.md` | Status verificado (e datado) de quem ainda oferece fine-tuning self-service: Google, OpenAI, Anthropic |
| `risco-validade-modelo-companion.md` | Quando cada modelo usado nesta disciplina perde suporte do provedor (retirement/deprecation) |
| `historico-fine-tuning-companion.md` | Como fine-tuning evoluiu como técnica, de BERT (2018) a LoRA/DPO, com fonte real em cada guinada |

## 🗂️ Tipos de arquivo em cada módulo

| Padrão | O que é |
|--------|---------|
| `*-tool.js` / `*_tool.py` | Ferramenta executável do módulo (JS e Python equivalentes) |
| `decision-framework-tool.js/.py` | Framework de decisão do Módulo 1, reutilizado por M3, M4 e M5 |
| `model-evaluation-harness-tool.js/.py` | Harness de avaliação do Módulo 5, reutilizado por M6 |
| `amplitude-seguros-casos.json` | Os 3 casos reais de fine-tuning da Amplitude Seguros (Auto, Saúde Empresarial, Atendimento) |
| `*.jsonl` | Datasets no formato JSONL, sintéticos, gerados para fins didáticos |
| `documentos-brutos/` | Imagens sintéticas de documento usadas na demo de extração via OCR (M2.1) |
| `ocr-vs-llm-extracao-comparativo.md` | Comparativo entre o pipeline de OCR clássico e extração via LLM multimodal, contraponto ao vídeo (M2.1) |
| `extracao-llm-multimodal-tool.js/.py` | Ferramenta complementar: manda a imagem direto pro Gemini multimodal, sem passar por OCR/regex (M2.1) |
| `mlx-data/` | Splits train/test/valid usados no treino local via MLX-LM (M4.2) |
| `mlx-adapters*/adapter_config.json` | Configuração dos adaptadores LoRA treinados (rank 4/8/16, full fine-tuning, e as corridas extras de 20/80 iterações usadas na análise de curva de convergência): **os pesos (`adapters.safetensors`) não estão neste repositório por tamanho** (até 1,9GB); veja "Como usar" abaixo |
| `model-card-*.md` | Ficha técnica do modelo treinado na Vertex AI (M3.5) |
| `fine-tuning-zoo-poster.html/.png` | Pôster de campo com o gate de decisão e as seis técnicas de fine-tuning do curso, em HTML (fonte editável) e PNG (M1.3) |
| `fine-tuning-types-cheatsheet.md` | Cheatsheet dos 7 tipos de fine-tuning com requisito prático de dado/hardware/hiperparâmetro (M1.3) |
| `mecanismo-estado-arte-companion.html` | "Bestiário do Zoo": dossiê de pesquisa sobre por que cada mecanismo de fine-tuning funciona, com 45+ fontes acadêmicas (M1.3) |
| `gcp-setup-companion.md` | Guia opcional de 7 passos pra configurar seu próprio projeto Google Cloud e rodar os jobs de fine-tuning com sua conta (M3.1) |
| `adapter-comparison-companion.md` | Comparação com/sem adapter LoRA carregado, mesmo exemplo, resultado real medido (M4.2) |
| `rank-adapter-comparison-companion.md` | Comparação de saída entre os 3 ranks de LoRA treinados (4, 8, 16) contra o mesmo exemplo novo (M4.3) |
| `casos-llm-as-judge-companion.md` | Texto completo (prompt, respostas, vereditos) dos 4 casos de LLM-as-judge que rolam no terminal sem slide próprio (M5.2) |
| `decisoes-de-arquitetura.md` | Documento de decisões de arquitetura do capstone (M6.3) |
| `guia-reavaliacao-pos-escala.md` / `guia-geracao-sintetica-via-llm.md` | Guias complementares do capstone: como reavaliar o modelo após escalar o dataset, e como gerar dado sintético via LLM (M6.3) |
| `Atividade N - Módulo N.pdf` | Missão Prática do módulo |
| `Exemplo - Módulo N.pdf` | Exemplo resolvido da atividade |

## 🛠️ Stack Central

- **Fine-tuning gerenciado:** Vertex AI / Gemini Enterprise Agent Platform (`gemini-2.5-flash`): o self-serve fine-tuning da OpenAI está em descontinuação e a Gemini API pública já não aceita fine-tuning desde maio/2025
- **Fine-tuning local (LoRA):** MLX-LM + Gemma 4 E2B (`mlx-community/gemma-4-e2b-it-bf16`, ~4,63B parâmetros), roda inteiro num Mac Apple Silicon, sem custo de nuvem
- **Códigos:** Node.js e Python (paridade funcional entre as duas versões em todo protótipo)
- **Case:** Amplitude Seguros: fine-tuning de modelo customizado para classificação e triagem de sinistros em duas linhas de produto (Auto e Saúde Empresarial)

### Por que dois provedores, e qual o trade-off

O curso usa **dois pilotos reais**, não um só, porque a pergunta certa não é "qual API de fine-tuning é a melhor", é "gerenciado ou local, e quando cada um vale a pena":

| | Vertex AI (gerenciado) | MLX local (LoRA) |
|---|---|---|
| Custo | Por job de treino + hospedagem do endpoint | Zero (usa sua própria GPU/Neural Engine) |
| Escala testada | 200 → 3.000 exemplos reais | 4,63B parâmetros, rank 4/8/16 e full FT |
| Infra | Nenhuma (sobe o dataset, dispara o job) | Mac com Apple Silicon e RAM suficiente |
| Dado | Sai pra nuvem do Google | Nunca sai da sua máquina |
| Caso de uso | Produção, escala, times sem GPU própria | Prototipagem rápida, dado sensível, controle total de custo |

Essa não é uma dicotomia teórica: os dois pilotos deste repositório rodaram de verdade. O job da Vertex AI treinou com 3.000 exemplos reais da Amplitude Seguros (`SUCCEEDED` em 24min53s), e o treino local rodou LoRA rank 4/8/16 e full fine-tuning no mesmo Gemma 4 E2B, com val loss real caindo de 4,856 para 0,779 na melhor configuração.

## ▶️ Como usar

1. Assista ao vídeo do módulo.
2. Para rodar uma ferramenta: `node <arquivo>.js` (ou `python3 <arquivo>.py`), sem dependências externas, só bibliotecas nativas de Node/Python.
3. Alguns scripts do Módulo 3, 4, 5 e 6 importam ferramentas de módulos anteriores (ex.: `veredito-escala-tool.js` usa o framework de decisão do Módulo 1); os caminhos já apontam para as pastas deste repositório, então funcionam sem ajuste.
4. **Adaptadores LoRA (Módulo 4):** os arquivos `adapter_config.json` estão incluídos, mas os pesos treinados (`adapters.safetensors`) não: são grandes demais para git (o checkpoint de full fine-tuning sozinho tem 1,9GB). Para gerar os seus, instale o [MLX-LM](https://github.com/ml-explore/mlx-lm), baixe o Gemma 4 E2B, e rode `local-lora-training-tool.js` (ou `.py`) na pasta `modulo-04-lora-e-peft/`; os splits de treino já estão em `mlx-data/`.
5. Faça a Missão Prática (`Atividade N - Módulo N.pdf`) e confira com o `Exemplo - Módulo N.pdf`.

---

*UNIPDS - Pós-graduação em Engenharia de Software com IA Aplicada*
