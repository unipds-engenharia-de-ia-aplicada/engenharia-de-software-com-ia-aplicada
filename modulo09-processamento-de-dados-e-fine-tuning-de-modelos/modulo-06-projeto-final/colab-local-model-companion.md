# Companion: `colab-local-model-notebook.ipynb`

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulo 6.2, alternativa multiplataforma ao MLX**

## O que é

O Módulo 6.2 desta disciplina expõe o checkpoint LoRA local do Módulo 4.2 como um processo Python (`chamar_modelo_local.py`) que `amplitude-seguros-assistente.js` chama via subprocess (`spawnSync`, flag `--local`): stdin recebe `{instrucao, entrada}` em JSON, stdout devolve o texto bruto da resposta do modelo. Esse script só existe em Python porque `mlx-lm` roda em Apple Silicon e não tem biblioteca equivalente em JavaScript, a mesma exceção que o Módulo 5.4 já estabeleceu.

Este companion resolve o mesmo problema pra quem não tem Mac Apple Silicon, em duas peças:

- **`colab-local-model-notebook.ipynb`** - treina o mesmo LoRA rank 8 (mesmo dataset, mesma receita real do Módulo 4.2 e do companion do Módulo 4.2), salva o adapter em disco, e reproduz o contrato exato de `chamar_modelo_local.py`, testado contra o mesmo exemplo real (Carlos Eduardo Matos Silva, com os dois valores distratores de peças e mão de obra) que a Demo, parte 4 do roteiro do Módulo 6.2 usa.
- **`chamar-modelo-local-hf.py`** - script standalone com o MESMO contrato stdin/stdout, usando `transformers` + `peft` em vez de `mlx-lm`. Roda em qualquer máquina Windows ou Linux com GPU CUDA local. Não treina nada - só carrega um adapter já pronto (o do notebook, ou qualquer adapter LoRA rank 8 salvo no mesmo formato) e responde inferência, exatamente como o `chamar_modelo_local.py` original.

**MLX continua sendo o caminho oficial desta disciplina.** Este companion, como os dos Módulos 4.2 e 5.4, é caminho B, auto-contido, pra quem não tem Apple Silicon.

## Por que não existe um adapter pronto pra baixar

O notebook do Módulo 4.2 (`colab-lora-training-notebook.ipynb`) usa `save_strategy="no"`, treina e testa tudo numa sessão só, sem persistir nada em disco. Por isso o notebook deste companion precisa treinar de novo (mesma receita, ~20 passos, minutos de GPU T4 grátis) antes de conseguir demonstrar a parte de inferência, não tem como pular direto pro "carregar um checkpoint pronto" sem que alguém rode o treino pelo menos uma vez.

## Status de validação (honesto)

O notebook rodou de verdade no Colab (GPU T4), do início ao fim, sem erro, contra o texto atual da Demo, parte 4 do roteiro do Módulo 6.2 (com os dois valores distratores de peças e mão de obra antes do total). O script standalone `chamar-modelo-local-hf.py` ainda não foi testado separadamente (só a lógica equivalente dentro do notebook, Passos 5-6).

## Resultado real (Colab, T4)

- **Treino**: 20 passos, 64,7s, loss de treino no passo final 0,9498, loss de validação no passo final 0,8303, acurácia média de token 79,5%, mesma ordem de grandeza de execuções anteriores deste companion e dos companions dos Módulos 4.2 (0,9579/0,8305/79,6%) e 5.4, dentro da variação normal de treino estocástico em GPU (não há controle de determinismo cross-plataforma igual ao MLX local).
- **Teste do Passo 6 (mesmo exemplo da Demo, parte 4 do Módulo 6.2, com os dois valores distratores de peças e mão de obra antes do total)**: resultado real. O modelo extraiu `segurado` e `placa` certos (`"Carlos Eduardo Matos Silva"`, `"QWE-4521"`), mas errou o `valor`: devolveu `187050` em vez de `1870.5` -- **o mesmo erro exato de execuções anteriores deste companion com o texto simples**, mesmo com dois valores parciais novos (R$ 1.200,00 e R$ 670,50) competindo antes do total no texto. Isso é diferente do que Vertex AI e MLX local produzem nesse mesmo exemplo (os dois batem exatamente, conforme a Demo, parte 4 do roteiro do Módulo 6.2 mostra); aqui, um dos três caminhos não convergiu no campo numérico. Não é erro de script (a resposta impressa é o texto bruto do modelo, sem pós-processamento); é um comportamento real do checkpoint treinado nesta rodada específica do HF/PEFT.
- **Confirmado sistemático (3 repetições)**: treinei o adapter do zero mais 3 vezes, mesma receita exata (seed=0), e testei cada um contra o mesmo exemplo complexo. **As 3 rodadas devolveram exatamente o mesmo erro, byte a byte**: `"valor":187050` nas três, com val_loss quase idêntico entre elas (0,8300 / 0,8296 / 0,8296). Somando com o teste inicial, são **4 de 4** com o texto atual -- e o mesmo padrão de execuções anteriores com o texto simples. Não é ruído de uma rodada só, nem efeito dos valores distratores: é um comportamento reproduzível deste checkpoint específico (LoRA rank 8, QLoRA 4 bits, 20 passos, este dataset) sobre a formatação decimal deste valor específico, indiferente à complexidade do texto ao redor.
- **Diagnóstico isolado (3 testes extra sem retreinar nada, reaproveitando o mesmo adapter -- não dependem do texto do Passo 6, continuam válidos)**: pra descobrir qual parte do valor causa o erro, testei três variações do mesmo caso. **Teste A**, mesmo texto, centavos redondos (`R$ 1.870,00`): acertou (`"valor":1870`). **Teste B**, valor pequeno, sem separador de milhar, mas com centavo fracionário (`R$ 87,50`): errou (`"valor":8750`, mesmo padrão de concatenar os dígitos). **Teste C**, um exemplo real do próprio dataset de treino, com centavo fracionário (`Vinicius Augusto Teixeira`, `R$ 3.780,90`): acertou (`"valor":3780.9`). Isso isola o problema com precisão: **não é o separador de milhar** (Teste B não tinha e ainda assim errou) e **o modelo não "nunca aprendeu" o padrão** (Teste C, memorizado do treino, saiu certo). O que falha especificamente é generalizar a conversão de centavo fracionário (vírgula decimal) pra um valor **novo, nunca visto no treino**. Funciona pra valor redondo novo, funciona pra valor fracionário memorizado, falha só na interseção das duas coisas: fracionário E novo. Consistente com (mas não prova isolada de) o trade-off de precisão da quantização 4-bit discutido na Camada 05 do poster, o dataset tem só 48 de 157 exemplos (30,6%) com centavo fracionário, e o treino de 20 passos é curto; um teste real de 8-bit vs. 4-bit, mesma receita, ainda não foi feito e isolaria se é quantização especificamente ou volume/duração de treino.
- **O que isso significa pra quem for usar este companion**: o caminho funciona (contrato stdin/stdout, carregar adapter, treinar do zero, tudo roda), mas **não deve ser apresentado como "prova de convergência de três frameworks" sem ressalva**, é uma alternativa funcional, com uma limitação real e reproduzível de formatação numérica que os outros dois caminhos (Vertex AI, MLX) não têm neste exemplo -- e que persiste idêntica mesmo com um texto mais difícil, o que reforça que a causa é a formatação decimal em si, não a complexidade do texto ao redor. Vale reportar isso explicitamente pra quem for seguir este caminho como parte da Missão Prática, em vez de assumir que vai bater sempre. Ver também `../modulo-04-lora-e-peft/gpu-cuda-anatomia-poster.html`, Camada 05, que documenta esse achado como exemplo real do trade-off de precisão da quantização.

## Quando usar

Pra alunos sem Mac Apple Silicon que querem exercitar o caminho `--local` do Módulo 6.2 (opcional, o demo principal do vídeo já funciona 100% contra o Vertex AI, sem depender disto). Dois casos:

- **Só quer ver o contrato funcionando, sem GPU local própria**: rodar `colab-local-model-notebook.ipynb` no Colab (T4 grátis já basta).
- **Tem GPU CUDA local (Windows/Linux)**: baixar o adapter gerado pelo notebook (pasta `gemma-amplitude-lora-colab-adapter/`), colocar nesta mesma pasta, e usar `chamar-modelo-local-hf.py` como script standalone, inclusive plugável de verdade em `amplitude-seguros-assistente.js`, trocando, na função `chamarModeloLocal`, o nome do arquivo na variável `scriptLocal` (linha 88) de `chamar_modelo_local.py` pra `chamar-modelo-local-hf.py`.

> Nota (set/2026): a disponibilidade de GPU T4 no tier gratuito do Colab varia por demanda (limite de horas semanais, restrição em horário de pico, às vezes downgrade silencioso pra CPU) e pode mudar sem aviso do Google. Confira o estado atual em [colab.research.google.com](https://colab.research.google.com) antes de depender disso pra uso real.

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
