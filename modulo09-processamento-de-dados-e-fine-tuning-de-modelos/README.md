# 🎛️ Processamento de Dados e Fine-Tuning de Modelos

Este repositório centraliza os prompts, ferramentas, dados e atividades desenvolvidos durante a disciplina de **Processamento de Dados e Fine-Tuning de Modelos**. Ao longo de 6 módulos, construímos o ciclo completo de fine-tuning sobre um caso único: a **Amplitude Seguros**, seguradora fictícia com linhas de Auto e Saúde Empresarial, indo da decisão de "vale a pena fazer fine-tuning?" (framework de 4 perguntas + AHP + NPV) até um modelo customizado real, treinado, avaliado e documentado.

**Professor:** [Dr. José Ahirton Batista Lopes Filho](https://github.com/ahirtonlopes)

---

## 📂 Estrutura do Repositório

Cada módulo tem sua pasta com os artefatos usados nas demos dos vídeos: ferramentas executáveis, dados de referência e a atividade prática (PDF).

```bash
.
├── modulo-01-decision-framework/    # Framework de 4 perguntas, AHP, NPV, cheatsheet dos 7 tipos de fine-tuning, pôster "zoo" das técnicas
├── modulo-02-preparacao-datasets/   # Extração OCR, schema JSONL, deduplicação (MinHash+LSH), balanceamento, comparativo OCR vs. LLM multimodal
├── modulo-03-fine-tuning-via-api/   # Upload, hiperparâmetros, automação, versionamento (Vertex AI)
├── modulo-04-lora-e-peft/           # LoRA, DoRA, QLoRA e full fine-tuning local (MLX/Apple Silicon), comparação de rank e custo-benefício, alternativas Colab/CUDA pra quem não tem Mac
├── modulo-05-avaliacao-modelos/     # (em breve)
└── modulo-06-projeto-final/         # (em breve)
```

## 💳 Antes de rodar: a API é paga, e a versão do modelo muda

As ferramentas que chamam a Vertex AI/Gemini de verdade (a maioria dos módulos 2 e 3) fazem chamada real e paga -- não é simulação nem mock. Dois avisos práticos antes de rodar por conta própria:

- **Custo real, mas baixo**: o job de fine-tuning supervisionado do Módulo 3.5 (200 exemplos, `gemini-2.5-flash`) custou R$2,39, conferido direto no billing real do Google Cloud (ver `model-card-amplitude-auto-saude-m3-200.md`). Ainda assim, é preciso conta Google Cloud com faturamento ativado e cartão cadastrado (a autorização inicial é só verificação, não cobrança automática do que você não usar). Contas novas costumam vir com crédito de avaliação (na época desta atualização, US$300 por 90 dias) -- mas o valor, o prazo, e principalmente **as exclusões pra serviços de IA generativa mudam com frequência e não são as mesmas pra todo produto de IA do Google** (ex.: a documentação oficial já exclui explicitamente "Gemini API in AI Studio" desse crédito, mesmo sendo Google). Não assuma que o crédito cobre automaticamente o fine-tuning via Vertex AI: confira o status vigente e as exclusões atuais em [cloud.google.com/free](https://cloud.google.com/free) antes de rodar, e trate o pagamento próprio como cenário real, não exceção.
- **Versão do modelo muda**: os nomes de modelo citados no código (`gemini-2.5-flash`, etc.) valiam no momento da gravação (ago-set/2026). Provedor gerenciado aposenta versão com aviso prévio -- confira `risco-validade-modelo-companion.md` (raiz deste repositório) antes de rodar, pra saber se a versão citada ainda está disponível e qual constante trocar no código se não estiver.
- **Alternativa sem custo de API nenhum**: o Módulo 4 tem caminho 100% local (MLX, Apple Silicon), sem nenhuma chamada paga -- ver `local-lora-training-tool.js`/`.py`, e o companion Colab (GPU T4 gratuita) pra quem não tem Mac Apple Silicon.

## 🔑 Antes de rodar: cada aluno configura os próprios recursos

Vários scripts desta disciplina precisam de um projeto GCP ou job de fine-tuning configurados via variável de ambiente. Sem essas variáveis definidas, o script para com um erro claro explicando o que falta -- nunca usa um valor padrão de terceiros.

**Passo 0, uma vez só:** siga `gcp-setup-companion.md` (raiz do Módulo 3) pra criar seu projeto GCP e habilitar a Vertex AI.

| Você já tem... | Defina | Usado em |
|---|---|---|
| Um projeto GCP com Vertex AI habilitado | `GCP_PROJECT_ID` | M2 (extração multimodal), M3 (pipeline Dolly, automação) |
| Um job de fine-tuning rodado (Missão Prática #3) | `TUNING_JOB_NAME` | M3 (upload/tracking, automação, hyperparameter/monitoring, versioning) |

Exemplo de uso:
```bash
export GCP_PROJECT_ID=meu-projeto-aqui
node extracao-llm-multimodal-tool.js
```

**Não tem Mac Apple Silicon, ou quer rodar sem custo de nuvem nenhum?** O Módulo 4 tem caminho 100% local: `local-lora-training-tool.js`/`.py` (M4.2) treina de verdade via MLX (Apple Silicon) -- pra quem não tem Mac, `colab-lora-training-notebook.ipynb` faz o mesmo treino via Hugging Face na GPU T4 gratuita do Colab (guia completo em `colab-lora-training-companion.md`).

## 🗂️ Tipos de arquivo em cada módulo

| Padrão | O que é |
|--------|---------|
| `*-tool.js` / `*_tool.py` | Ferramenta executável do módulo (JS e Python equivalentes) |
| `decision-framework-tool.js/.py` | Framework de decisão do Módulo 1, reutilizado por M3 e M4 |
| `amplitude-seguros-casos.json` | Os 3 casos reais de fine-tuning da Amplitude Seguros (Auto, Saúde Empresarial, Atendimento) |
| `*.jsonl` | Datasets no formato JSONL, sintéticos, gerados para fins didáticos |
| `documentos-brutos/` | Imagens sintéticas de documento usadas na demo de extração via OCR (M2.1) |
| `ocr-vs-llm-extracao-comparativo.md` | Comparativo entre o pipeline de OCR clássico e extração via LLM multimodal, contraponto ao vídeo (M2.1) |
| `extracao-llm-multimodal-tool.js/.py` | Ferramenta complementar: manda a imagem direto pro Gemini multimodal, sem passar por OCR/regex (M2.1) |
| `privacy-preserving-finetuning-companion.md` | Companion de fine-tuning com dado regulado: privacidade diferencial, PII, LGPD (M2.1) |
| `model-card-*.md` | Ficha técnica do modelo treinado na Vertex AI (M3.5) |
| `dataset-real-alternativo-companion.md` | Dataset real alternativo (Dolly-15k) pra quem quiser praticar sem dado sintético (M3.4) |
| `fine-tuning-zoo-poster.html/.png` | Pôster de campo com o gate de decisão e as seis técnicas de fine-tuning do curso, em HTML (fonte editável) e PNG (M1.3) |
| `fine-tuning-types-cheatsheet.md` | Cheatsheet dos 7 tipos de fine-tuning com requisito prático de dado/hardware/hiperparâmetro (M1.3) |
| `mecanismo-estado-arte-companion.html` | Bestiário do Zoo: mecanismo técnico e estado da arte 2025-2026 de cada uma das 7 técnicas do cheatsheet (M1.3) |
| `gcp-setup-companion.md` | Guia opcional de 7 passos pra configurar seu próprio projeto Google Cloud e rodar os jobs de fine-tuning com sua conta (M3.1) |
| `*-config.yaml` | Config real do `mlx_lm.lora` usado pra treinar cada checkpoint (rank 4/8/16), reproduzível com `python3 -m mlx_lm lora --config <arquivo>.yaml` (M4.2/M4.3) |
| `mlx-data/` | Splits train/test/valid usados no treino local via MLX-LM (M4.2) |
| `mlx-adapters*/adapter_config.json` | Configuração dos adaptadores LoRA treinados (rank 4/8/16, full fine-tuning): **os pesos (`adapters.safetensors`) não estão neste repositório por tamanho** (até 1,9GB); veja "Como usar" abaixo |
| `adapter-comparison-companion.md` | Comparação com/sem adapter LoRA carregado, mesmo exemplo, resultado real medido (M4.2) |
| `rank-adapter-comparison-companion.md` | Comparação de saída entre os 3 ranks de LoRA treinados (4, 8, 16) contra o mesmo exemplo novo (M4.3) |
| `*-notebook.ipynb` | Notebook Colab, alternativa multiplataforma pra quem não tem Apple Silicon (M4.2) |
| `gpu-cuda-anatomia-poster.html` | Pôster de campo com corte transversal real de GPU/CUDA (M4.2) |
| `Atividade N - Módulo N.pdf` | Missão Prática do módulo |
| `Exemplo - Módulo N.pdf` | Exemplo resolvido da atividade |

## 🛠️ Stack Central

- **Fine-tuning gerenciado:** Vertex AI / Gemini Enterprise Agent Platform (`gemini-2.5-flash`): o self-serve fine-tuning da OpenAI está em descontinuação e a Gemini API pública já não aceita fine-tuning desde maio/2025
- **Fine-tuning local (LoRA):** MLX-LM + Gemma 4 E2B (`mlx-community/gemma-4-e2b-it-bf16`), roda inteiro num Mac Apple Silicon, sem custo de nuvem
- **Códigos:** Node.js e Python (paridade funcional entre as duas versões em todo protótipo)
- **Case:** Amplitude Seguros: fine-tuning de modelo customizado para classificação e triagem de sinistros em duas linhas de produto (Auto e Saúde Empresarial)

### Por que dois provedores, e qual o trade-off

O curso usa **dois pilotos reais**, não um só, porque a pergunta certa não é "qual API de fine-tuning é a melhor", é "gerenciado ou local, e quando cada um vale a pena":

| | Vertex AI (gerenciado) | MLX local (LoRA) |
|---|---|---|
| Custo | Por job de treino + hospedagem do endpoint | Zero (usa sua própria GPU/Neural Engine) |
| Escala testada | 200 exemplos reais (Amplitude Auto + Saúde Empresarial) | Rank 4/8/16 e full fine-tuning |
| Infra | Nenhuma (sobe o dataset, dispara o job) | Mac com Apple Silicon e RAM suficiente |
| Dado | Sai pra nuvem do Google | Nunca sai da sua máquina |
| Caso de uso | Produção, escala, times sem GPU própria | Prototipagem rápida, dado sensível, controle total de custo |

Essa não é uma dicotomia teórica: os dois pilotos deste repositório rodaram de verdade. O job da Vertex AI treinou com os 200 exemplos reais da Amplitude Seguros (`SUCCEEDED` em 45min42s, R$2,39 no billing), e o treino local rodou LoRA rank 4/8/16 e full fine-tuning no mesmo Gemma 4 E2B -- ver `adapter-comparison-companion.md` e `rank-adapter-comparison-companion.md` pros resultados reais medidos de cada configuração.

## ▶️ Como usar

1. Assista ao vídeo do módulo.
2. Para rodar uma ferramenta: `node <arquivo>.js` (ou `python3 <arquivo>.py`), sem dependências externas, só bibliotecas nativas de Node/Python.
3. Alguns scripts do Módulo 3 e 4 importam ferramentas de módulos anteriores (ex.: `reavaliacao-saude-empresarial.js`, M3.2, usa o framework de decisão do Módulo 1); os caminhos já apontam para as pastas deste repositório, então funcionam sem ajuste.
4. **Adaptadores LoRA (Módulo 4):** os arquivos `adapter_config.json` estão incluídos, mas os pesos treinados (`adapters.safetensors`) não: são grandes demais para git (o checkpoint de full fine-tuning sozinho tem 1,9GB). Para gerar os seus, instale o [MLX-LM](https://github.com/ml-explore/mlx-lm), baixe o Gemma 4 E2B, e rode `local-lora-training-tool.js` (ou `.py`) na pasta `modulo-04-lora-e-peft/`; os splits de treino já estão em `mlx-data/`.
5. Faça a Missão Prática (`Atividade N - Módulo N.pdf`) e confira com o `Exemplo - Módulo N.pdf`.

---

*UNIPDS - Pós-graduação em Engenharia de Software com IA Aplicada*
