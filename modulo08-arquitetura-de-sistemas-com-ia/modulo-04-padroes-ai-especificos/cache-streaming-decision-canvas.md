# Canvas de Decisão: Cache e Streaming
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 4.3**

Use este checklist antes de aplicar cache ou streaming a um fluxo de IA. Os três padrões de hoje não competem entre si: resolvem camadas diferentes do mesmo problema, e um sistema maduro costuma usar os três ao mesmo tempo, em pontos diferentes.

## Passo 1: A pergunta em si já foi feita antes?

1. **Perguntas de usuários diferentes convergem pro mesmo conteúdo, com palavras diferentes?**
   Sim → candidato a **Semantic Cache** (embedding + similaridade vetorial contra pares pergunta-resposta já processados).
   Não → siga para o Passo 2.

2. **Um erro nesta resposta específica é caro ou irreversível?** (framework do Módulo 1.3)
   Sim → **não** use Semantic Cache aqui, mesmo que a pergunta pareça repetida: recompute sempre.
   Não → calibre o limiar de similaridade com cuidado: frouxo demais devolve resposta errada com confiança total; apertado demais nunca acerta o cache.

**Cuidado com tenant:** se o seu sistema atende mais de um estudo clínico ou mais de um cliente na mesma infraestrutura, o cache nunca deveria cruzar essa fronteira — uma resposta cacheada de um estudo vazando pra outro é violação de confidencialidade, não só resposta errada. Isso fica mais explícito no Módulo 5, mas o cuidado começa aqui, na hora de decidir a chave do cache.

## Passo 2: O contexto se repete, mesmo quando a pergunta muda?

1. **O mesmo documento longo, ou o mesmo system prompt, é reenviado em toda chamada?**
   Sim → candidato a **Prompt Cache** (cacheia o processamento do contexto, não a resposta final).
   Não → prossiga para o Passo 3 sem aplicar Prompt Cache aqui.

2. **Esse contexto muda de versão ao longo do tempo?** (ex.: emenda de protocolo)
   Sim → garanta invalidação de cache atrelada à mudança de versão, não só acúmulo: cache sem invalidação correta espalha informação desatualizada.

## Passo 3: A geração é longa o suficiente pra streaming importar?

1. **A resposta completa leva mais de alguns segundos pra ficar pronta?**
   Sim → use **Response Streaming**: não economiza tempo real, mas mantém o usuário dentro do limiar de 1 segundo de Nielsen em vez de cruzar o limiar de 10 segundos de uma tela parada.
   Não → resposta já é rápida o bastante; streaming não muda percepção que já é boa.

2. **A resposta ainda depende de aprovação (Approval Gate) antes de virar oficial?**
   Sim → deixe visualmente claro que o texto em streaming é rascunho, não texto já validado.

## Aplicado ao TrialForge

| Padrão | Onde se aplica | Onde NÃO se aplica | Padrão de referência |
|---|---|---|---|
| Semantic Cache | Perguntas de rotina de CRAs/monitores sobre o protocolo | Síntese final do CSR (erro caro e irreversível) | GPTCache (Fu Bang/Zilliz, NLP-OSS 2023) |
| Prompt Cache | Documento do protocolo, reenviado pelos 3 agentes | Nenhuma (ganho quase sempre vale a pena aqui) | (sem citação externa direta) |
| Response Streaming | Geração do CSR (tarefa mais longa do sistema) | Respostas curtas, já rápidas por natureza | Limiar de 1s de Nielsen |

## Como usar na atividade prática

1. Pegue um fluxo do seu próprio sistema (ou hipotético) com alto volume de requisições.
2. Rode os três passos em sequência. Não pule direto pro streaming sem checar cache primeiro.
3. Marque explicitamente onde um erro caro/irreversível te impede de usar Semantic Cache, mesmo que a pergunta pareça repetida.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
