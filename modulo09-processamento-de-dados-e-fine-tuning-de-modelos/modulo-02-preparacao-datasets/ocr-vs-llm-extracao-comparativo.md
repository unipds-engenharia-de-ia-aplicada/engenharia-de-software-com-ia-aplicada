# OCR Clássico vs. LLM Multimodal: Comparativo Real de Extração
> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo Complementar - Módulo 2.1**

O vídeo ensina o pipeline de OCR clássico (`extraction-to-jsonl-tool.js`/`.py`): Tesseract real + parser tolerante a variação de rótulo. Este é o contraponto que o vídeo não cobre: mandar a mesma imagem direto pro Gemini multimodal (`extracao-llm-multimodal-tool.js`/`.py`), pedindo o JSON estruturado sem nenhum passo de OCR ou regex no meio.

Os dois caminhos rodaram de verdade contra os mesmos 4 documentos sintéticos de `documentos-brutos/`, comparados contra o mesmo gabarito (`esperado`) usado no teste automatizado do pipeline de OCR.

## Resultado real, lado a lado

| | OCR clássico (Tesseract + regex) | LLM multimodal (Gemini 2.5 Flash) |
|---|---|---|
| Acerto de campo | 12/12 (100%) | 12/12 (100%) |
| Confiança/certeza por documento | 94,3% · 95,8% · 95,7% · 95,9% (confiança do OCR) | não aplicável (o modelo não reporta confiança nativa) |
| Latência por documento | milissegundos (local, sem rede) | ~2,6s a ~4,8s (chamada de rede pra Vertex AI) |
| Custo por chamada | zero (binário local) | ~2.384 tokens de entrada + ~40 de saída por documento |
| Código de parsing necessário | uma função por layout (`parsear_orcamento_auto`, `parsear_recibo_saude`), cada uma com sua lista de padrões regex | um único prompt genérico, reaproveitado sem alteração pros dois layouts diferentes |
| Dependência externa | binário `tesseract` instalado localmente | rede + autenticação Vertex AI + custo de API |

## O que isso realmente prova (e o que não prova)

Nos dois lados, o acerto foi 100%. **Isso não significa que as duas abordagens são equivalentes** -- significa que estes 4 documentos sintéticos foram desenhados pra serem tratáveis por OCR (texto limpo, sem ruído, sem rotação), exatamente pra provar o ponto pedagógico do Módulo 2.1 sobre parser tolerante a rótulo.

A diferença real que aparece nos números não é de acerto, é de **engenharia**: o pipeline OCR precisou de uma função de parsing dedicada por tipo de documento (orçamento de oficina vs. recibo médico), cada uma com sua própria lista de padrões regex, porque cada layout usa um vocabulário de rótulo diferente ("Nome do segurado" vs. "Beneficiario", "Total" vs. "Valor cobrado"). O caminho multimodal usou o mesmo prompt genérico nos dois layouts, sem nenhuma linha de código específica de layout.

## Quando cada abordagem vale mais

| Cenário | Abordagem melhor | Por quê |
|---|---|---|
| Volume alto, layout já conhecido e estável (nota fiscal padronizada, formulário fixo) | OCR clássico | Sem custo de rede por chamada, sem depender de disponibilidade de API externa, latência desprezível |
| Poucos documentos, muitos layouts diferentes, layout muda com frequência | LLM multimodal | Não exige escrever/manter um parser novo a cada formato novo |
| Documento manuscrito, foto de celular torta, digitalização ruim | LLM multimodal tende a se sair melhor | Modelos multimodais são mais robustos a ruído visual do que OCR + regex rígido |
| Dado sensível que não pode sair da rede local | OCR clássico (ou LLM local/self-hosted) | Tesseract roda inteiro na máquina; a chamada multimodal aqui sai pra Vertex AI |

## Rode você mesmo

```bash
# OCR clássico (já ensinado no vídeo)
node extraction-to-jsonl-tool.js
python3 extraction_to_jsonl_tool.py

# Contraponto: LLM multimodal (requer gcloud autenticado no projeto amplitude-seguros-demo)
node extracao-llm-multimodal-tool.js
python3 extracao_llm_multimodal_tool.py
```

Os dois scripts do LLM multimodal chamam a API de verdade (mesmo projeto GCP dos jobs reais de fine-tuning do Módulo 3) e reportam latência e uso de token real de cada chamada, não um número estimado.

**Material extra relacionado:** pra quem quer saber se existe lib de mercado pronta pra cada peça deste módulo (OCR, dedup, normalização, etc.), ver `de-para-bibliotecas-de-mercado.md`, na mesma pasta.

---

*Ahirton Lopes · Fine-Tuning Toolkit, UNIPDS: Processamento de Dados e Fine-Tuning de Modelos*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
