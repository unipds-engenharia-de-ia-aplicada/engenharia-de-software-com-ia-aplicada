# Canvas de Calibração de Cascata
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 5.4 (protótipo final da disciplina)**

Use este canvas pra calibrar sua própria cascata de model tiering. Não copie o limiar do TrialForge, ele é específico do nomic-embed-text em português. Mesma disciplina do Módulo 4.5: medir, não assumir.

## 1. Defina os tiers

| Tier | Modelo/API | Custo estimado por chamada | Quando é tentado |
|---|---|---|---|
| _ex.: Tier 1 (barato)_ | _gemma4:e2b (Ollama local)_ | _~$0,001_ | Sempre, primeiro |
| _ex.: Tier 2 (caro)_ | _gemma4:latest (Ollama local)_ | _~$0,01_ | Só se o Tier 1 não convencer |
| _ex.: Tier 3 (frontier, opcional)_ | _não implementado no TrialForge, entraria no mesmo ponto_ | _maior_ | Só se o Tier 2 também não convencer |
| Tier 1 (barato) | | | Sempre, primeiro |
| Tier 2 (caro) | | | Só se o Tier 1 não convencer |
| Tier 3 (frontier, opcional) | | | Só se o Tier 2 também não convencer |

**Onde consultar preço real, não estimar de cabeça:** os números da tabela acima ficam velhos rápido — não hardcode um valor de agora numa cascata que ainda vai rodar daqui a seis meses. Três fontes que se atualizam sozinhas, sem você caçar post de blog: o `model_prices_and_context_window.json` da LiteLLM ([github.com/BerriAI/litellm](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json)) — o mesmo LiteLLM já citado como API Gateway de referência no Módulo 5.1, com custo por token de cada modelo novo sincronizado automaticamente assim que o provedor lança; a página de modelos do OpenRouter ([openrouter.ai/models](https://openrouter.ai/models)) — comparação ao vivo de custo por milhão de tokens entre centenas de modelos, com múltiplos provedores servindo o mesmo modelo a preços diferentes; e a calculadora oficial do provedor que você for usar de verdade (a AWS Bedrock já apareceu no Módulo 5.3). Nota pro seu caso se ele for parecido com o TrialForge: Ollama local não tem custo por token, é hardware/energia — o "custo estimado por chamada" da tabela acima vira uma amortização sua, não um preço de mercado.

## 2. Calibre os limiares de escalação (método FrugalGPT, com dois sinais)

A cascata usa DOIS sinais, não um — descoberto rodando contra o Ollama de verdade, não assumido de antemão. Confiança de **busca**: achou a cláusula certa pra pergunta (Módulo 4.1)? Confiança de **resposta**, g(pergunta, resposta) como no paper original do FrugalGPT: a resposta que o Tier 1 gerou ficou fiel à cláusula que recebeu? Teste os dois contra pares reais do seu domínio:

| Caso de teste | Confiança de busca | Confiança de resposta | Tier 1 bastou? | Escalaria? |
|---|---|---|---|---|
| _ex.: pergunta de rotina, dentro do banco de cláusulas (assentimento de menores)_ | _0,803_ | _1,000_ | _Sim_ | _Não, os dois acima do limiar_ |
| _ex.: pergunta fora do banco de cláusulas (prazo de exames laboratoriais)_ | _0,648_ | _~0,82_ | _Não_ | _Sim, busca abaixo do limiar_ |
| Pergunta simples, resposta claramente certa | | | | |
| Pergunta ambígua, resposta duvidosa | | | | |
| Pergunta fora do domínio conhecido | | | | |

Por que dois sinais, não um: na pergunta fora do banco, a busca errou a cláusula — confiança baixa, corretamente — mas o Tier 1 ainda respondeu de forma fiel à cláusula ERRADA que recebeu, confiança de resposta alta (~0,82), porque seguir a cláusula fornecida e a cláusula fornecida ser a certa são coisas diferentes. Confiança de resposta sozinha escondia o erro de busca. O oposto também é um risco real, só que não aparece nessas 2 perguntas: o Tier 1 inventar algo além de uma cláusula certa — aí é a confiança de resposta que cairia, com a busca ainda alta.

Nota sobre a síntese de CSR no TrialForge: a confiança de busca medida nesse caso foi 0,667 (abaixo do limiar também), mas isso não importa: síntese de CSR tem regra fixa pro Tier 2, independente do valor de confiança (Módulo 1.3, erro caro e irreversível). Não confunda "escalou pela cascata" com "foi direto por regra fixa": os dois terminam no Tier 2, por motivos diferentes.

Limiares escolhidos: busca **______**, resposta **______** — cada um deve separar claramente os casos "bastou" dos casos "duvidoso", com folga (Módulo 4.2: calibrar com folga, não no ponto exato de corte). No TrialForge, os dois em 0,75: busca fica entre 0,803 (dentro do domínio) e 0,648 (fora do domínio); resposta fica abaixo dos dois valores reais de resposta fiel medidos (1,000 e ~0,82), então não dispara em nenhuma resposta legítima observada — existe pra pegar alucinação além da cláusula, um caso que essas 2 perguntas não exercitam. Coincide numericamente com o limiar de Semantic Cache do Módulo 4.5 (também 0,75) só por acaso, são decisões diferentes calibradas contra o mesmo nomic-embed-text.

Errar qualquer um dos dois limiares em qualquer direção tem custo, não só um dos dois lados: frouxo demais escala pro Tier 2 com frequência, corroendo a economia que é o motivo de a cascata existir; apertado demais aceita respostas do Tier 1 que deveriam ter escalado, servindo qualidade pior sem nenhuma economia real (o Tier 2 nunca chega a ser chamado pra corrigir).

Essa cascata já é produto, não só paper: o Model Router do Azure AI Foundry roteia entre famílias e tamanhos de modelo (de nano até modelos de fronteira) com três modos declarados - Balanceado, Custo e Qualidade; o Amazon Bedrock Intelligent Prompt Routing aplica o mesmo princípio entre dois modelos da mesma família, com economia publicada em torno de 30% em uso geral.

## 3. Orçamento por tenant: checklist

- [ ] Existe um identificador de tenant (estudo, cliente, time) em toda requisição?
- [ ] O orçamento é verificado ANTES da chamada ao modelo, não depois?
- [ ] Existe uma regra fixa (não sujeita à cascata) pra tarefas de erro caro e irreversível?
- [ ] A trilha de auditoria registra: tier usado, se escalou, gasto acumulado, limite do tenant?

TrialForge / Vitalis Platform confirma os quatro itens acima: cada requisição carrega o identificador do estudo, o orçamento é verificado antes da chamada ao modelo (Módulo 5.2), a síntese de CSR nunca escala pela cascata (regra fixa, Módulo 1.3), e a trilha registra tier usado, se escalou e o gasto acumulado por estudo.

## 4. Os três comportamentos que sua entrega precisa demonstrar

- [ ] Um caso onde o Tier 1 resolve sozinho, sem escalar
- [ ] Um caso onde a cascata escala pro Tier 2 (ou além)
- [ ] Um caso bloqueado por orçamento, antes de qualquer chamada de modelo

TrialForge / Vitalis Platform confirmou os três comportamentos no protótipo: uma pergunta de rotina resolvida no Tier 1 sem escalar, uma pergunta fora do banco de cláusulas escalando pro Tier 2, e uma requisição de um estudo que já estourou o orçamento bloqueada antes de qualquer chamada de modelo.

## 5. Reflexão final: quando a cascata cresce

Depois de rodar os três casos da seção 4, responda em uma frase: com base no volume de escalação que você observou, que sinal indicaria que sua cascata de dois tiers precisaria virar três? Pode ser uma fração de requisições que ainda escala mesmo depois de calibrar o limiar direito, um padrão de pergunta que o Tier 2 também erra, ou um custo acumulado que passou do orçamento esperado. Você não precisa adicionar o terceiro tier agora, só reconhecer o sinal que justificaria fazer isso.

## 6. Vá além: seu orçamento sobrevive à concorrência de verdade?

As seções 1-5 testam o Gateway uma requisição de cada vez, sequencial — mas uma plataforma enterprise (Módulo 5.1) recebe dezenas de estudos batendo ao mesmo tempo. `node trialforge-model-tiering-prototype.js --volume` dispara ~17 requisições simultâneas via `Promise.all`, espalhadas por 4 estudos, incluindo um com orçamento apertado de propósito recebendo 5 requisições concorrentes.

Isso expõe (e no TrialForge já corrigido) um race condition real de "check-then-act": se orçamento é *checado* num passo e só *debitado* depois de um `await` (a chamada ao modelo), N requisições concorrentes do mesmo estudo podem todas passar pela checagem antes de qualquer uma debitar — e todas gastarem, estourando o limite. `reservarOrcamento` fecha essa janela debitando o pior caso no mesmo passo síncrono da checagem, sem nenhum `await` no meio.

No seu protótipo: rode suas próprias requisições em paralelo (não só sequencial) contra o mesmo tenant com orçamento apertado, e confirme se o gasto final realmente respeita o limite. Se não respeitar, você achou o mesmo bug — e já sabe o padrão pra corrigir.

## Como usar na Missão Prática #05

1. Preencha as seções 1 e 2 com dados reais do seu próprio contexto. Rode o teste de verdade, não estime de cabeça.
2. Implemente o checklist da seção 3 no seu protótipo.
3. Rode os três casos da seção 4 e anexe o log da execução à entrega, junto com este canvas preenchido.
4. Responda a reflexão da seção 5 com uma frase.
5. Opcional (vá além): teste a seção 6 — orçamento sob concorrência de verdade, não só sequencial.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
