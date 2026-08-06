# Canvas de Prompts de Reflexão
> **Ahirton Lopes · AI Architecture Toolkit**
> **Artefato de Demo - Módulo 2.3**

Use este template para separar a chamada de Execução da chamada de Reflexão: a mesma chamada não deve pedir os dois ao mesmo tempo.

---

## Prompt 1: Execução

```
[Instrução da tarefa original: gerar o documento, tomar a decisão, produzir o rascunho]
```

## Prompt 2: Reflexão (chamada separada, recebe o output do Prompt 1)

```
Você recebeu o seguinte resultado: [RESULTADO DA EXECUÇÃO]

Sua função agora não é melhorar o texto de forma genérica. É procurar especificamente por:
1. [categoria de erro específica ao seu domínio, ex: divergência numérica entre seções]
2. [categoria de erro específica, ex: contradição de critério de inclusão/exclusão]
3. [categoria de erro específica, ex: ausência de citação regulatória obrigatória]

Para cada problema encontrado, aponte a localização exata e o motivo. Se não encontrar nenhum problema
nas categorias acima, declare explicitamente "nenhuma divergência encontrada nas categorias verificadas",
sem gerar elogio genérico.
```

**Por que a lista de categorias é obrigatória:** um prompt de reflexão vago ("revise isso") tende a produzir confirmação genérica. Nomear as categorias de erro que importam para o seu documento é o que transforma reflexão de teatro em verificação real.

**Cuidado no sentido oposto:** uma reflexão instruída a caçar problema também pode inventar um problema que não existe, só para "cumprir a tarefa" de encontrar algo. Antes de escalar pro Approval Gate, confira se o problema apontado é verificável objetivamente (como a divergência de idade do exemplo abaixo) ou se é uma interpretação discutível — só o primeiro tipo deveria travar o fluxo automaticamente; o segundo merece uma segunda leitura humana antes de virar bloqueio.

---

## Exemplo preenchido: TrialForge, CSR em português vs. inglês

**Prompt 1: Execução (preenchido):**
```
Gere o rascunho do Relatório de Estudo Clínico (CSR) do protocolo já aprovado, em português, e também
a versão traduzida em inglês para submissão regulatória à FDA.
```

**Prompt 2: Reflexão (preenchido):**
```
Você recebeu o seguinte resultado: [as duas versões do CSR, português e inglês]

Sua função agora não é melhorar o texto de forma genérica. É procurar especificamente por:
1. Divergência numérica entre as duas versões (idade mínima, tamanho da amostra, doses)
2. Contradição de critério de inclusão/exclusão entre as duas versões
3. Ausência de citação regulatória obrigatória em qualquer uma das versões

Para cada problema encontrado, aponte a localização exata e o motivo. Se não encontrar nenhum problema
nas categorias acima, declare explicitamente "nenhuma divergência encontrada nas categorias verificadas",
sem gerar elogio genérico.
```

**Achado:** a versão em inglês registra idade mínima de doze anos para participação no estudo; a versão em português registra treze anos. Não é diferença de estilo de tradução, é divergência de dado regulatório real.

**Resposta Refletida:** o agente não corrige o número sozinho. Ele sinaliza a divergência explicitamente e aciona o Approval Gate do diagrama de referência (Módulo 1.2), porque decidir qual dos dois números está correto é decisão regulatória, não estilística. O valor da reflexão aqui não foi gerar a resposta certa automaticamente, foi encontrar o problema antes que ele chegasse à ANVISA ou à FDA como inconsistência não detectada.

---

## Seu caso: preencha os dois prompts com o seu contexto

1. No Prompt 1, troque o placeholder pela instrução real da sua tarefa (o documento, a decisão ou o rascunho que você quer que o agente produza).
2. No Prompt 2, troque as 3 categorias genéricas entre colchetes pelas categorias de erro que realmente importam no seu domínio.
3. Para cada categoria, escreva também o porquê: qual o risco concreto de esse tipo de erro passar sem ser percebido no seu contexto. Essa justificativa é o que calibra se a reflexão está procurando o que de fato interessa, não só gerando uma lista de categorias por procurar.

| Categoria de erro (seu domínio) | Por quê |
|---|---|
| | |
| | |
| | |

---

## Dois níveis de reflexão: quando usar cada um

| Nível | O que verifica | Custo | Quando usar |
|---|---|---|---|
| **Superfície** | Formato, completude, consistência interna do próprio texto | Baixo | Sempre: é barato e pega os erros mais comuns |
| **Conteúdo** | Alinhamento factual com uma fonte externa (protocolo, dado de origem) | Alto: exige acesso à fonte e mais uma chamada de modelo | Documentos de alto risco (regulatório, financeiro, segurança) |

---

## Reforço: segundo modelo para reflexão

Quando o risco justifica o custo extra, use um modelo de família diferente do que gerou o resultado original para fazer a reflexão. Reduz a chance de o mesmo ponto cego aparecer nas duas etapas.

---

*Ahirton Lopes · AI Architecture Toolkit, UNIPDS: Arquitetura de Sistemas com IA*
*Prof. Ahirton Lopes, Ph.D., GDE AI, Microsoft MVP, Senior Manager*
