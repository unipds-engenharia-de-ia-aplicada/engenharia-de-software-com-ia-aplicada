# Dataset de Produção, Amplitude Seguros (Módulo 6)

Ahirton Lopes · Fine-Tuning Toolkit
UNIPDS: Processamento de Dados e Fine-Tuning de Modelos

## O que é este arquivo

`amplitude-seguros-dataset-producao-3000.jsonl` é o dataset real de treino usado pelo job de produção da disciplina: 3.000 exemplos curados (1.800 Amplitude Auto + 1.200 Amplitude Saúde Empresarial), no schema canônico (`instrucao`/`entrada`/`saida`/`metadata`) usado desde o Módulo 2. É o mesmo dataset, convertido pro formato `contents`/`role`/`parts`, que treinou o modelo publicado neste módulo.

Cada linha é um exemplo real, gerado pelo pipeline formal desta disciplina, não um placeholder: 3 personas de redação por fonte (bloco formal, texto corrido, exportação abreviada), campos distratores reais (apólice, franquia, convênio, guia, CRM) que não fazem parte do schema extraído, e ruído real de OCR em ~9% dos exemplos.

## Por que 3.000, e não mais

3.000 é o volume do **modelo desta disciplina**, escolhido por um motivo específico, não por limite técnico: pra uma tarefa estreita de extração estruturada, a literatura já citada nesta disciplina (LIMA, Zhou et al. 2023) mostra que curadoria de qualidade bate volume bruto além de um certo ponto. 3.000 exemplos curados, com boa diversidade de fonte (10 oficinas + 8 clínicas) e redação, já está na faixa onde o ganho marginal de mais dado começa a cair pra este tipo de tarefa.

## O teto real não é este arquivo, é o gerador

Este arquivo é uma fotografia de um volume específico. **O recurso de verdade pra Missão Prática #06 é o gerador**, entregue em `m6-dataset-scaling-tool.js` (e `m6_dataset_scaling_tool.py`), junto com o pipeline de limpeza/balanceamento do Módulo 2.2. Rodar `node m6-dataset-scaling-tool.js` reproduz este dataset do zero, com todas as escolhas de escala visíveis e editáveis no código: número de fontes, personas de redação, campos distratores, taxa de ruído de OCR, e os alvos finais de balanceamento.

Ao aplicar o framework desta disciplina ao próprio caso (Passo 2 da Missão Prática #06), o volume certo não é 3.000, nem qualquer outro número fixo daqui: é o que o caso real do aluno suportar, medido, e ajustado editando os mesmos parâmetros que geraram este arquivo.

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
