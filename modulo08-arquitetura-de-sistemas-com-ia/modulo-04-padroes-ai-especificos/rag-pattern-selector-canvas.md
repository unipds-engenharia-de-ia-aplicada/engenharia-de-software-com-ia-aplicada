# Seletor de Padrão de RAG
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 4.1**

Use esta árvore antes de implementar (ou expandir) uma busca RAG. Ela não pede que você use os quatro padrões sempre: ajuda a diagnosticar qual falta no seu sistema específico, sintoma por sintoma.

## A árvore de decisão

**Antes de rodar:** essas três perguntas não são mutuamente exclusivas. Responda todas, sem parar no primeiro "Sim" — seu sistema pode ter mais de um sintoma ao mesmo tempo e precisar de mais de um padrão junto.

1. **Sua busca falha em termo exato, código ou identificador raro?**
   Sim → adicione **Hybrid Search** (busca esparsa/BM25 + vetor, combinados via Reciprocal Rank Fusion).
   Não → siga para a pergunta 2.

2. **Seu sistema busca em mais de um domínio de documento (tipos diferentes, vocabulário diferente)?**
   Sim → separe em **Multi-Index** (um índice vetorial por domínio, com roteamento de qual índice buscar).
   Não → siga para a pergunta 3.

3. **Uma única busca raramente traz informação suficiente pra responder com confiança?**
   Sim → torne a busca **Agentic** (loop de busca-avalia-busca-de-novo, com limite explícito de iterações).
   Não → **Basic RAG** já resolve: chunking, embedding, retrieval, augmentation, uma volta só.

## Aplicado ao TrialForge

| Sintoma real | Padrão adicionado | Onde apareceu | Padrão de referência |
|---|---|---|---|
| Busca de cláusula funcionando bem, caso simples | Basic RAG | Módulo 2 (Agente ICF) | Lewis et al., NeurIPS 2020 |
| Tema formulado em linguagem natural não bateria com uma lista fixa de palavras-chave | Hybrid Search | Limite real da simulação por palavra-chave do Módulo 2.5 | Cormack, Clarke & Büttcher (Reciprocal Rank Fusion) |
| Três agentes, três tipos de documento, buscas contaminando resultado uns dos outros | Multi-Index | Módulo 3 (Agente ICF / Protocolo / CSR) | (sem citação externa direta) |
| Decidir SE uma seção condicional entra no documento exige mais de uma busca | Agentic RAG | Seção de assentimento de menor (Módulo 2.2) | FLARE (Jiang et al., 2023); Self-RAG (Asai et al., ICLR 2024) |

## Como usar na atividade prática

1. Pegue um sistema de busca/RAG do seu próprio contexto (ou hipotético, se ainda não tiver um).
2. Rode a árvore acima, pergunta por pergunta, documentando a resposta e o porquê.
3. Liste quais dos quatro padrões você já tem, e qual seria o próximo a adicionar, e qual sintoma real justificaria essa adição, não só "por precaução".

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
