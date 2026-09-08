# 🎛️ Processamento de Dados e Fine-Tuning de Modelos

Este repositório centraliza os prompts, ferramentas, dados e atividades desenvolvidos durante a disciplina de **Processamento de Dados e Fine-Tuning de Modelos**. Ao longo de 6 módulos, construímos o ciclo completo de fine-tuning sobre um caso único: a **Amplitude Seguros**, seguradora fictícia com linhas de Auto e Saúde Empresarial, indo da decisão de "vale a pena fazer fine-tuning?" (framework de 4 perguntas + AHP + NPV) até um modelo customizado real, treinado, avaliado e documentado.

**Professor:** [Dr. José Ahirton Batista Lopes Filho](https://github.com/ahirtonlopes)

---

## 📂 Estrutura do Repositório

Cada módulo tem sua pasta com os artefatos usados nas demos dos vídeos: ferramentas executáveis, dados de referência e a atividade prática (PDF).

```bash
.
├── modulo-01-decision-framework/    # Framework de 4 perguntas, AHP, NPV, cheatsheet dos 6 tipos de fine-tuning, Bestiário do Zoo das técnicas
├── modulo-02-preparacao-datasets/   # Extração OCR, schema JSONL, deduplicação (MinHash+LSH), balanceamento, comparativo OCR vs. LLM multimodal
├── modulo-03-fine-tuning-via-api/   # Upload, hiperparâmetros, automação, versionamento (Vertex AI)
├── modulo-04-lora-e-peft/           # LoRA, DoRA, QLoRA e full fine-tuning local (MLX/Apple Silicon), comparação de rank e custo-benefício, alternativas Colab/CUDA pra quem não tem Mac
├── modulo-05-avaliacao-modelos/     # (em breve)
└── modulo-06-projeto-final/         # (em breve)
```

## 🗂️ Tipos de arquivo em cada módulo

| Padrão | O que é |
|--------|---------|
| `*-tool.js` / `*_tool.py` | Ferramenta executável do módulo (JS e Python equivalentes) |
| `decision-framework-tool.js/.py` | Framework de decisão do Módulo 1, reutilizado por módulos seguintes |
| `amplitude-seguros-casos.json` | Os 3 casos reais de fine-tuning da Amplitude Seguros (Auto, Saúde Empresarial, Atendimento) |
| `*.jsonl` | Datasets no formato JSONL, sintéticos, gerados para fins didáticos |
| `ocr-vs-llm-extracao-comparativo.md` | Comparativo entre o pipeline de OCR clássico e extração via LLM multimodal, contraponto ao vídeo (M2.1) |
| `extracao-llm-multimodal-tool.js/.py` | Ferramenta complementar: manda a imagem direto pro Gemini multimodal, sem passar por OCR/regex (M2.1) |
| `privacy-preserving-finetuning-companion.md` | Companion de fine-tuning com dado regulado: privacidade diferencial, PII, LGPD (M2.1) |
| `model-card-*.md` | Ficha técnica do modelo treinado na Vertex AI (M3.5) |
| `fine-tuning-zoo-poster.html/.png` | Pôster de campo com o gate de decisão e as seis técnicas de fine-tuning do curso (M1.3) |
| `mecanismo-estado-arte-companion.html` | Bestiário do Zoo: mecanismo técnico e estado da arte 2025-2026 de cada uma das 7 técnicas do cheatsheet (M1.3) |
| `gcp-setup-companion.md` | Guia opcional de setup de projeto Google Cloud (M3.1) |
| `dataset-real-alternativo-companion.md` | Dataset real alternativo (Dolly-15k) pra quem quiser praticar sem dado sintético (M3.4) |
| `Atividade N - Módulo N.pdf` | Missão Prática do módulo |
| `Exemplo - Módulo N.pdf` | Exemplo resolvido da atividade |
| `*-config.yaml` | Config real do `mlx_lm.lora` usado pra treinar cada checkpoint (rank 4/8/16), reproduzível com `python3 -m mlx_lm lora --config <arquivo>.yaml` (M4.2/M4.3) |
| `mlx-adapters*/` | Checkpoints LoRA reais (pesos + config), rank 4/8/16, prontos pra inferência sem retreinar (M4.2/M4.3) |
| `*-notebook.ipynb` | Notebook Colab, alternativa multiplataforma pra quem não tem Apple Silicon (M4.2) |
| `gpu-cuda-anatomia-poster.html` | Pôster de campo com corte transversal real de GPU/CUDA (M4.2) |

## 🛠️ Stack Central

- **Fine-tuning gerenciado:** Vertex AI / Gemini Enterprise Agent Platform (`gemini-2.5-flash`): o self-serve fine-tuning da OpenAI está em descontinuação e a Gemini API pública já não aceita fine-tuning desde maio/2025
- **Códigos:** Node.js e Python (paridade funcional entre as duas versões em todo protótipo)
- **Case:** Amplitude Seguros: fine-tuning de modelo customizado para classificação e triagem de sinistros em duas linhas de produto (Auto e Saúde Empresarial)

## ▶️ Como usar

1. Assista ao vídeo do módulo.
2. Para rodar uma ferramenta: `node <arquivo>.js` (ou `python3 <arquivo>.py`), sem dependências externas, só bibliotecas nativas de Node/Python.
3. Alguns scripts do Módulo 3 importam ferramentas de módulos anteriores (ex.: framework de decisão do Módulo 1); os caminhos já apontam para as pastas deste repositório, então funcionam sem ajuste.
4. Faça a Missão Prática (`Atividade N - Módulo N.pdf`) e confira com o `Exemplo - Módulo N.pdf`.

---

*UNIPDS - Pós-graduação em Engenharia de Software com IA Aplicada*
