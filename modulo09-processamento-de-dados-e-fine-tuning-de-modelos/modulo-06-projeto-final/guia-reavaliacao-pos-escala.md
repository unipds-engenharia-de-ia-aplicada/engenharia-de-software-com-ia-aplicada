# Guia: Reavaliação Pós-Escala, o Modelo Ainda Vale o que Valia no Dia do Gate

Ahirton Lopes · Fine-Tuning Toolkit
UNIPDS: Processamento de Dados e Fine-Tuning de Modelos

## Quando usar este guia

O checklist de graduação do Módulo 5.4 responde uma pergunta específica: no dia em que
o piloto foi medido, ele bateu os cinco critérios pra escalar? Isso não responde a
segunda pergunta, que só aparece depois que o modelo já está em produção: **ele ainda
bate hoje?**

Este guia é uma expansão opcional pra quem quiser ir além do escopo desta disciplina e
montar essa segunda verificação no próprio projeto (Missão Prática #06, Passo 4). Não é
pré-requisito de entrega, é um caminho pra quem quiser aplicar o mesmo rigor de "medir
de novo, não assumir" que a disciplina usa do primeiro ao último módulo, também depois
do deploy.

## Por que isso importa, com um exemplo real desta própria disciplina

Ao revisar o checklist de graduação do Módulo 5.4, uma comparação que alimentava um
critério de passa/falha vinha de uma execução só de chamada de modelo, meses antes.
Remedir com 20 chamadas reais confirmou a variância já esperada: a precisão do modelo
genérico variou de 54,5% a 72,7% entre execuções, média de 61,8%, não um número fixo
único.

Esse tipo de drift não é hipotético nem exclusivo desta disciplina: um estudo de
Stanford e UC Berkeley (Chen, Zaharia e Zou, 2023, "How Is ChatGPT's Behavior Changing
over Time?", arXiv:2307.09009) mediu o GPT-4 na mesma tarefa (identificar se um número
é primo ou composto, com raciocínio passo a passo) em março e em junho de 2023, com o
mesmo protocolo de avaliação nos dois momentos: 84% de acerto em março, 51% em junho -
uma queda real de 33 pontos percentuais em três meses, no mesmo modelo, na mesma
tarefa, sem nenhuma mudança no benchmark. A causa identificada pelos autores: o modelo
ficou menos receptivo à técnica de chain-of-thought que sustentava o resultado de março
(o ganho da técnica caiu de +24,4 pontos em março pra +0,1 ponto em junho). É
exatamente o cenário que este guia endereça: ninguém mudou a pergunta, o modelo por
trás da resposta mudou.

O ponto não é que a medição original estivesse errada. É que **um número medido uma vez
é um instantâneo, não uma garantia permanente**, e isso vale tanto pra comparação entre
dois modelos quanto pra um único modelo já em produção, meses depois do gate que aprovou
ele.

## O princípio central: comparar contra o número do dia do gate, não contra uma expectativa solta

A mesma disciplina de decisão medida que abre o framework do Módulo 1 se aplica aqui:
não é "o modelo parece pior" (opinião), é "o modelo mede X hoje contra Y no dia do gate,
numa diferença de Z pontos" (dado). Pra isso funcionar, o número do dia do gate precisa
estar registrado em algum lugar reproduzível, não só lembrado.

## Passo a passo

### 1. Congele o número do dia do gate, com o método de medição junto

Não basta guardar "91,7% de robustez estrutural" (valor ilustrativo, não um resultado real desta disciplina). Guarde também: quantos exemplos, qual
endpoint/versão do modelo, se a chamada é determinística ou não e, se não for, quantas
repetições sustentam o número. Sem isso, uma remedição futura não tem contra o que
comparar de forma justa. O formato de `decisoes-de-arquitetura.md` (Escolha, Alternativa
rejeitada, Por quê, Resultado real) já serve bem pra isso, é só garantir que o "Resultado
real" inclua a metodologia, não só o número final.

### 2. Defina o gatilho da reavaliação, não deixe indefinido

"De vez em quando" não é um gatilho. Duas opções concretas, qualquer uma é válida desde
que seja explícita: cadência fixa (ex.: a cada três meses, o mesmo intervalo que o
Módulo 3.2 usou pra reavaliar Saúde Empresarial), ou gatilho por volume (ex.: a cada mil
novas interações reais processadas em produção).

### 3. Reuse o harness de avaliação que já existe, não escreva outro do zero

Se o seu projeto já tem uma função que mede schema válido e precisão por campo (o
padrão que o Módulo 5 usa o curso inteiro), a reavaliação chama essa mesma função contra
o endpoint de hoje. Escrever uma segunda lógica de avaliação só pra isso é o tipo exato
de duplicação que esta disciplina evita em todo lugar.

### 4. Se a chamada não for 100% determinística, não confie numa execução só

Mesmo com `temperature=0`, uma API hospedada pode variar de execução pra execução,
isso já foi confirmado dentro desta própria disciplina. Rode a reavaliação um número
razoável de vezes (10 a 20, dependendo do custo de cada chamada) antes de comparar
contra o número congelado no Passo 1, e reporte a faixa observada, não só um valor
único.

### 5. Documente o resultado, os dois sentidos são achados válidos

Se o número se manteve: isso é uma confirmação real, vale registrar como tal, não é
"nada aconteceu". Se caiu: isso é drift, e o próximo passo é investigar causa raiz
(mudou o modelo genérico usado como baseline? mudou o perfil de dado de entrada em
produção? o próprio endpoint fine-tunado foi substituído?) antes de decidir se
precisa de um novo ciclo de fine-tuning.

## Esqueleto de código (dummy, ilustrativo, não é o projeto completo)

O trecho abaixo mostra só a forma da reavaliação, não uma integração real. Ele não
chama nenhuma API de verdade, os valores em `MEDIDO_NO_GATE` e a função
`chamarModeloDeVerdade` são exemplos pra você substituir pelos do seu próprio caso.

```javascript
'use strict';

// Substitua pelos números reais congelados no dia da graduação do SEU projeto,
// junto com a metodologia que os produziu (Passo 1 do guia).
const MEDIDO_NO_GATE = {
  data: '2026-08-17',
  metrica: 'precisao_media_teste_retido',
  valor: 91.7,
  metodologia: 'chamada unica, endpoint XXXX, ver metodologia real do Passo 1',
};

// Dummy: em um projeto real, isso chamaria a API de inferência de verdade,
// e reusaria a mesma função de avaliação (schema + precisão por campo) que
// o resto do projeto já usa. Aqui só ilustra a forma da comparação.
async function chamarModeloDeVerdade(exemplo) {
  throw new Error('Substitua por uma chamada real ao seu endpoint de produção.');
}

async function reavaliarComRepeticoes(conjuntoTeste, repeticoes = 10) {
  const resultadosPorRepeticao = [];
  for (let i = 0; i < repeticoes; i += 1) {
    let acertos = 0;
    for (const exemplo of conjuntoTeste) {
      const resposta = await chamarModeloDeVerdade(exemplo);
      if (respostaBate(resposta, exemplo.saidaEsperada)) acertos += 1;
    }
    resultadosPorRepeticao.push((acertos / conjuntoTeste.length) * 100);
  }
  return {
    media: media(resultadosPorRepeticao),
    minimo: Math.min(...resultadosPorRepeticao),
    maximo: Math.max(...resultadosPorRepeticao),
    repeticoes,
  };
}

function compararComGate(resultadoHoje) {
  const diferenca = resultadoHoje.media - MEDIDO_NO_GATE.valor;
  const status = Math.abs(diferenca) < 2 ? 'ESTAVEL' : diferenca < 0 ? 'DRIFT_NEGATIVO' : 'MELHOROU';
  return {
    medidoNoGate: MEDIDO_NO_GATE.valor,
    medidoHoje: resultadoHoje.media,
    faixaHoje: [resultadoHoje.minimo, resultadoHoje.maximo],
    diferenca,
    status,
  };
}

function media(valores) {
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

function respostaBate(resposta, esperado) {
  // Dummy: substitua pela mesma lógica de comparação que o harness real usa.
  return JSON.stringify(resposta) === JSON.stringify(esperado);
}
```

O que este esqueleto não faz de propósito: não chama API nenhuma de verdade (você
conecta ao seu próprio endpoint), não decide sozinho o que fazer com um drift
detectado (isso é julgamento humano, documentado, não automação), e não substitui o
harness de avaliação real do seu projeto, só orquestra uma chamada repetida a ele.

## O que este guia não resolve

Ele não decide a cadência certa pra você, isso depende do custo de cada chamada e da
criticidade do caso. Ele não automatiza a decisão de re-treinar, essa continua sendo
uma decisão humana registrada, no mesmo formato de `decisoes-de-arquitetura.md`. E ele
não substitui monitoramento contínuo de produção (latência, taxa de erro, custo), que é
uma disciplina de infraestrutura fora do escopo deste curso, não de reavaliação de
qualidade de modelo.

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
