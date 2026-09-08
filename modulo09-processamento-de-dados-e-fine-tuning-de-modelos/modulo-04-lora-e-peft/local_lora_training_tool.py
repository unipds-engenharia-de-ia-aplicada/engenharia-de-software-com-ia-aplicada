"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Módulo 4.2 (referência espelhada em Python do .js oficial)

Converte o mesmo dataset real de 200 exemplos que o Módulo 3.2 subiu pro
Vertex AI (formato Gemini: contents/role/parts) pro formato que o MLX-LM
espera (messages: role/content), divide em train/valid/test, valida
hiperparâmetros antes de qualquer treino, e orquestra o processo local
mlx_lm.lora via subprocess -- o equivalente, em treino local, à chamada
de rede que o Módulo 3.2 fez contra a API do Vertex AI. Aqui não tem rede
nenhuma: o "provedor" é a própria máquina.

Uso: python3 local_lora_training_tool.py
"""

import json
import subprocess
from pathlib import Path

DATASET_ORIGEM = Path(__file__).parent.parent / "modulo-03-fine-tuning-via-api" / "dataset-treinado.jsonl"
DIR_DADOS_MLX = Path(__file__).parent / "mlx-data"


# ============================================================================
# 1. Conversão: formato Gemini (Módulo 3) -> formato MLX-LM (messages)
# ============================================================================


def converter_exemplo_para_mensagens(exemplo_gemini):
    turno_usuario = next((c for c in exemplo_gemini["contents"] if c["role"] == "user"), None)
    turno_modelo = next((c for c in exemplo_gemini["contents"] if c["role"] == "model"), None)
    if turno_usuario is None or turno_modelo is None:
        raise ValueError('exemplo incompleto: precisa de um turno "user" e um turno "model"')
    return {
        "messages": [
            {"role": "user", "content": turno_usuario["parts"][0]["text"]},
            {"role": "assistant", "content": turno_modelo["parts"][0]["text"]},
        ]
    }


def extrair_nome_entidade(exemplo_mlx):
    mensagens = exemplo_mlx["messages"]
    if len(mensagens) < 2:
        return None
    try:
        saida = json.loads(mensagens[1]["content"])
    except (json.JSONDecodeError, TypeError, KeyError):
        return None
    return saida.get("segurado") or saida.get("beneficiario")


def dividir_train_valid_test(exemplos, proporcao_valid=0.15, proporcao_test=0.05):
    """Divide por proporção fixa, agrupando por entidade (segurado/
    beneficiário) antes de dividir -- corrige vazamento real encontrado em
    31/08: o dataset de origem tem só vinte e oito pessoas sintéticas
    distintas nos duzentos exemplos, cada uma repetida em vários templates
    de documento (até onze vezes a mesma pessoa). Um corte sequencial
    simples deixava a mesma pessoa aparecer no treino E no teste, só com
    cabeçalho de oficina/clínica diferente -- "exemplo nunca visto no
    treino" não era estritamente verdade no nível de conteúdo.
    Determinístico (sem aleatoriedade, preservando a reprodutibilidade que
    a versão anterior já buscava): ordena entidades por contagem
    crescente, desempate alfabético, preenche teste primeiro, depois
    validação, resto treino -- nenhuma entidade fica partida entre splits.
    """
    n = len(exemplos)
    n_valid = round(n * proporcao_valid)
    n_test = round(n * proporcao_test)

    grupos = {}
    sem_entidade = []
    for ex in exemplos:
        nome = extrair_nome_entidade(ex)
        if nome is None:
            sem_entidade.append(ex)
            continue
        grupos.setdefault(nome, []).append(ex)

    entidades_ordenadas = sorted(grupos.items(), key=lambda item: (len(item[1]), item[0]))

    test, valid, train = [], [], []
    for _, grupo in entidades_ordenadas:
        if len(test) < n_test:
            test.extend(grupo)
        elif len(valid) < n_valid:
            valid.extend(grupo)
        else:
            train.extend(grupo)
    train.extend(sem_entidade)

    return {"train": train, "valid": valid, "test": test}


def preparar_dados_mlx(caminho_dataset_origem, dir_saida):
    with open(caminho_dataset_origem, encoding="utf-8") as f:
        linhas = [l for l in f.read().strip().split("\n") if l]
    exemplos_gemini = [json.loads(l) for l in linhas]
    exemplos_mlx = [converter_exemplo_para_mensagens(e) for e in exemplos_gemini]
    divisao = dividir_train_valid_test(exemplos_mlx)

    dir_saida = Path(dir_saida)
    dir_saida.mkdir(parents=True, exist_ok=True)

    def escrever(nome, exemplos):
        with open(dir_saida / nome, "w", encoding="utf-8") as f:
            for e in exemplos:
                f.write(json.dumps(e, ensure_ascii=False) + "\n")

    escrever("train.jsonl", divisao["train"])
    escrever("valid.jsonl", divisao["valid"])
    escrever("test.jsonl", divisao["test"])

    return {
        "total": len(exemplos_mlx),
        "train": len(divisao["train"]),
        "valid": len(divisao["valid"]),
        "test": len(divisao["test"]),
    }


# ============================================================================
# 2. Validação de hiperparâmetros (mesma disciplina do Módulo 3.3, aplicada
#    aos hiperparâmetros específicos de LoRA local)
# ============================================================================


def validar_hiperparametros_lora(config):
    erros = []
    iters = config.get("iters")
    if not isinstance(iters, int) or isinstance(iters, bool) or iters <= 0:
        erros.append("iters precisa ser um inteiro positivo")
    batch_size = config.get("batchSize")
    if not isinstance(batch_size, int) or isinstance(batch_size, bool) or batch_size <= 0:
        erros.append("batchSize precisa ser um inteiro positivo")
    learning_rate = config.get("learningRate")
    if not isinstance(learning_rate, (int, float)) or isinstance(learning_rate, bool) or not (0 < learning_rate <= 1):
        erros.append("learningRate precisa estar entre 0 (exclusivo) e 1")
    if config.get("fineTuneType") not in ("lora", "full"):
        erros.append('fineTuneType precisa ser "lora" ou "full"')
    return {"valido": len(erros) == 0, "erros": erros}


# ============================================================================
# 3. Orquestração: monta o comando e roda mlx_lm.lora local via subprocess
# ============================================================================


def montar_argumentos_lora(config):
    return [
        "-m", "mlx_lm", "lora",
        "--model", config["model"],
        "--train",
        "--data", config["dataDir"],
        "--fine-tune-type", config["fineTuneType"],
        "--iters", str(config["iters"]),
        "--batch-size", str(config["batchSize"]),
        "--learning-rate", str(config["learningRate"]),
        "--adapter-path", config["adapterPath"],
    ]


def extrair_metricas(texto_saida):
    """Extrai as linhas "Iter N: Val loss X" da saída real do mlx_lm.lora.
    Função pura, testável sem rodar o processo de verdade."""
    import re
    iteracoes = []
    for m in re.finditer(r"Iter (\d+): Val loss ([\d.]+)", texto_saida):
        iteracoes.append({"iter": int(m.group(1)), "valLoss": float(m.group(2))})
    return iteracoes


def analisar_curva_convergencia(metricas, limiar_platô=0.03):
    """Recebe a lista de {iter, valLoss} que extrair_metricas devolve e
    diagnostica onde está a melhor iteração (menor val loss, a escolha que
    early stopping faria), se o treino parou cedo demais (val loss ainda
    caindo forte no último ponto medido, sinal de subtreino) ou tarde demais
    (val loss subiu em relação ao mínimo, sinal de overfitting)."""
    if len(metricas) < 2:
        raise ValueError("precisa de pelo menos 2 pontos pra analisar convergência")
    ordenado = sorted(metricas, key=lambda m: m["iter"])
    melhor = min(ordenado, key=lambda m: m["valLoss"])
    penultimo, ultimo = ordenado[-2], ordenado[-1]
    queda_relativa_final = (penultimo["valLoss"] - ultimo["valLoss"]) / penultimo["valLoss"]
    return {
        "melhorIteracao": melhor["iter"],
        "melhorValLoss": melhor["valLoss"],
        "quedaRelativaFinal": queda_relativa_final,
        "aindaCaindoForte": queda_relativa_final > limiar_platô,
        "sinalDeOverfitting": ultimo["valLoss"] > melhor["valLoss"] * (1 + limiar_platô) and melhor["iter"] != ultimo["iter"],
    }


def rodar_treino_local(config, ao_receber_linha=lambda t: None, popen_fn=subprocess.Popen):
    """Roda o processo local de verdade. popen_fn injetavel pra permitir
    teste sem executar treino real (default: subprocess.Popen real)."""
    args = montar_argumentos_lora(config)
    processo = popen_fn(
        [config["pythonBin"]] + args,
        cwd=config.get("cwd"),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    saida_completa = ""
    for linha in processo.stdout:
        saida_completa += linha
        ao_receber_linha(linha)
    codigo = processo.wait()
    if codigo != 0:
        raise RuntimeError(f"mlx_lm.lora saiu com código {codigo}")
    return {"saidaCompleta": saida_completa, "metricas": extrair_metricas(saida_completa)}


# ---------------------------------------------------------------------------
# Testes automatizados
# ---------------------------------------------------------------------------

_total_testes = 0
_testes_com_falha = 0


def testar(descricao, fn):
    global _total_testes, _testes_com_falha
    _total_testes += 1
    try:
        fn()
        print(f"  [OK] {descricao}")
    except AssertionError as erro:
        _testes_com_falha += 1
        print(f"  [FALHOU] {descricao}")
        print(f"           {erro}")


def rodar_testes():
    print("== Testes: conversão Gemini -> messages ==")

    def t1():
        exemplo = {
            "contents": [
                {"role": "user", "parts": [{"text": "pergunta"}]},
                {"role": "model", "parts": [{"text": "resposta"}]},
            ]
        }
        convertido = converter_exemplo_para_mensagens(exemplo)
        assert convertido == {
            "messages": [
                {"role": "user", "content": "pergunta"},
                {"role": "assistant", "content": "resposta"},
            ]
        }

    testar("converte um exemplo com turno user e model pro formato messages", t1)

    def t2():
        try:
            converter_exemplo_para_mensagens({"contents": [{"role": "user", "parts": [{"text": "x"}]}]})
            assert False, "deveria ter lançado ValueError"
        except ValueError:
            pass

    testar('rejeita exemplo sem turno "model"', t2)

    print()
    print("== Testes: divisão train/valid/test ==")

    def t3():
        exemplos = [
            {"messages": [{"role": "user", "content": f"ex{i}"}, {"role": "assistant", "content": json.dumps({"segurado": f"Pessoa {i}", "placa": "ABC-1234", "valor": 100})}]}
            for i in range(200)
        ]
        d = dividir_train_valid_test(exemplos)
        assert len(d["train"]) + len(d["valid"]) + len(d["test"]) == 200
        assert len(d["valid"]) == 30
        assert len(d["test"]) == 10
        assert len(d["train"]) == 160

    testar("divide 200 exemplos de entidades únicas em proporção 80/15/5 sem perder nenhum", t3)

    def t3b():
        exemplos = []
        for p in range(20):
            repeticoes = 11 if p < 5 else 3
            for r in range(repeticoes):
                exemplos.append({
                    "messages": [
                        {"role": "user", "content": f"ex{p}-{r}"},
                        {"role": "assistant", "content": json.dumps({"segurado": f"Pessoa {p}", "placa": "ABC-1234", "valor": 100})},
                    ]
                })
        d = dividir_train_valid_test(exemplos)
        split_por_nome = {}
        for rotulo in ("train", "valid", "test"):
            for ex in d[rotulo]:
                nome = json.loads(ex["messages"][1]["content"])["segurado"]
                if nome in split_por_nome:
                    assert split_por_nome[nome] == rotulo, f"{nome} apareceu em mais de um split"
                else:
                    split_por_nome[nome] = rotulo

    testar("nenhuma entidade fica partida entre splits, mesmo quando repete muitas vezes", t3b)

    def t4():
        exemplos = [
            {"messages": [{"role": "user", "content": f"ex{i}"}, {"role": "assistant", "content": json.dumps({"segurado": f"Pessoa {i}", "placa": "ABC-1234", "valor": 100})}]}
            for i in range(20)
        ]
        r1 = dividir_train_valid_test(exemplos)
        r2 = dividir_train_valid_test(exemplos)
        assert r1 == r2

    testar("a divisão é determinística: mesma entrada, mesma saída, sem embaralhar", t4)

    print()
    print("== Testes: validação de hiperparâmetros ==")

    def t5():
        r = validar_hiperparametros_lora({"iters": 20, "batchSize": 1, "learningRate": 1e-5, "fineTuneType": "lora"})
        assert r["valido"] is True
        assert r["erros"] == []

    testar("config válida passa sem erro", t5)

    def t6():
        r = validar_hiperparametros_lora({"iters": 0, "batchSize": 1, "learningRate": 1e-5, "fineTuneType": "lora"})
        assert r["valido"] is False
        assert any("iters" in e for e in r["erros"])

    testar("iters zero ou negativo é rejeitado", t6)

    def t7():
        r = validar_hiperparametros_lora({"iters": 20, "batchSize": 1, "learningRate": 1.5, "fineTuneType": "lora"})
        assert r["valido"] is False
        assert any("learningRate" in e for e in r["erros"])

    testar("learningRate fora de (0, 1] é rejeitado", t7)

    def t8():
        r = validar_hiperparametros_lora({"iters": 20, "batchSize": 1, "learningRate": 1e-5, "fineTuneType": "qlora-turbo"})
        assert r["valido"] is False
        assert any("fineTuneType" in e for e in r["erros"])

    testar("fineTuneType fora da lista permitida é rejeitado", t8)

    print()
    print("== Testes: extração de métricas da saída real do processo ==")

    def t9():
        saida_fake = "\n".join([
            "Trainable parameters: 0.147% (6.816M/4628.569M)",
            "Iter 1: Val loss 4.839, Val took 12.3s",
            "Iter 10: Val loss 1.204, Val took 11.9s",
            "Iter 20: Val loss 0.380, Val took 12.1s",
        ])
        metricas = extrair_metricas(saida_fake)
        assert len(metricas) == 3
        assert metricas[0] == {"iter": 1, "valLoss": 4.839}
        assert metricas[2] == {"iter": 20, "valLoss": 0.380}

    testar("extrai val loss de uma saída real de mlx_lm.lora, múltiplas iterações", t9)

    def t10():
        assert extrair_metricas("nenhuma métrica aqui") == []

    testar("saída sem nenhuma linha de val loss retorna lista vazia, não erro", t10)

    print()
    print("== Testes: orquestração do processo (com processo falso injetado) ==")

    def t11():
        class ProcessoFalso:
            def __init__(self):
                self.stdout = iter(["Iter 1: Val loss 4.839\n", "Iter 20: Val loss 0.380\n"])
                self.returncode = 0

            def wait(self):
                return 0

        def popen_falso(*args, **kwargs):
            return ProcessoFalso()

        resultado = rodar_treino_local(
            {"pythonBin": "python3", "model": "x", "dataDir": "y", "fineTuneType": "lora", "iters": 20, "batchSize": 1, "learningRate": 1e-5, "adapterPath": "z", "cwd": "."},
            popen_fn=popen_falso,
        )
        assert len(resultado["metricas"]) == 2
        assert resultado["metricas"][1]["valLoss"] == 0.380

    testar("rodarTreinoLocal resolve com métricas quando o processo falso termina com código 0", t11)

    def t12():
        class ProcessoFalsoComErro:
            def __init__(self):
                self.stdout = iter([])
                self.returncode = 1

            def wait(self):
                return 1

        def popen_falso_com_erro(*args, **kwargs):
            return ProcessoFalsoComErro()

        try:
            rodar_treino_local(
                {"pythonBin": "python3", "model": "x", "dataDir": "y", "fineTuneType": "lora", "iters": 20, "batchSize": 1, "learningRate": 1e-5, "adapterPath": "z", "cwd": "."},
                popen_fn=popen_falso_com_erro,
            )
            assert False, "deveria ter lançado RuntimeError"
        except RuntimeError:
            pass

    testar("rodarTreinoLocal rejeita quando o processo falso termina com código diferente de 0", t12)

    print()
    print("== Testes: análise da curva de convergência ==")

    def t13():
        # curva real do treino de 20 iterações deste módulo (mlx_lm.lora, steps-per-eval 5)
        curva_20_iters = [
            {"iter": 1, "valLoss": 4.752},
            {"iter": 5, "valLoss": 2.923},
            {"iter": 10, "valLoss": 1.567},
            {"iter": 15, "valLoss": 1.173},
            {"iter": 20, "valLoss": 0.907},
        ]
        r = analisar_curva_convergencia(curva_20_iters)
        assert r["melhorIteracao"] == 20
        assert r["aindaCaindoForte"] is True, "val loss caiu mais de 22% entre iter 15 e 20, isso é subtreino, não convergência"
        assert r["sinalDeOverfitting"] is False

    testar("20 iterações (o treino real deste módulo): ainda caindo forte, sem overfitting, é subtreino", t13)

    def t14():
        # mesmo treino, estendido pra 120 iterações real (steps-per-eval 10)
        curva_120_iters = [
            {"iter": 1, "valLoss": 4.752},
            {"iter": 10, "valLoss": 1.533},
            {"iter": 20, "valLoss": 0.916},
            {"iter": 30, "valLoss": 0.687},
            {"iter": 40, "valLoss": 0.624},
            {"iter": 50, "valLoss": 0.536},
            {"iter": 60, "valLoss": 0.553},
            {"iter": 70, "valLoss": 0.513},
            {"iter": 80, "valLoss": 0.504},
            {"iter": 90, "valLoss": 0.474},
            {"iter": 100, "valLoss": 0.485},
            {"iter": 110, "valLoss": 0.496},
            {"iter": 120, "valLoss": 0.520},
        ]
        r = analisar_curva_convergencia(curva_120_iters)
        assert r["melhorIteracao"] == 90, "iter 90 tem o menor val loss (0,474), não a última iteração"
        assert r["aindaCaindoForte"] is False, "entre iter 110 e 120 o val loss piorou, não é mais queda forte"
        assert r["sinalDeOverfitting"] is True, "val loss em 120 (0,520) já é pior que o mínimo em 90 (0,474)"

    testar("120 iterações (mesmo treino, estendido): melhor iteração em 90, overfitting a partir de 100", t14)

    def t15():
        try:
            analisar_curva_convergencia([{"iter": 1, "valLoss": 1.0}])
            assert False, "deveria ter lançado ValueError com um ponto só"
        except ValueError:
            pass

    testar("rejeita análise com menos de 2 pontos", t15)

    print()
    print(
        f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), "
        f"{_testes_com_falha} falhou(falharam)."
    )

    if _testes_com_falha > 0:
        raise AssertionError(f"{_testes_com_falha} teste(s) falharam. A implementação não bate com a especificação.")


# ---------------------------------------------------------------------------
# Demo: preparar dados de verdade a partir do dataset real do Módulo 3
# ---------------------------------------------------------------------------


def rodar_preparacao_de_verdade():
    print()
    print("===== Preparando dados reais pro treino local (a partir do dataset do Módulo 3) =====\n")
    stats = preparar_dados_mlx(DATASET_ORIGEM, DIR_DADOS_MLX)
    print(f"Dataset de origem: {DATASET_ORIGEM}")
    print(f"Total de exemplos: {stats['total']}")
    print(f"  train.jsonl: {stats['train']} exemplos")
    print(f"  valid.jsonl: {stats['valid']} exemplos")
    print(f"  test.jsonl:  {stats['test']} exemplos")
    print(f"Escrito em: {DIR_DADOS_MLX}")
    return stats


# ---------------------------------------------------------------------------
# Demo: curva de convergência de verdade -- a mesma configuração deste
# módulo, repetida com iters=20 (val loss final 0,895 na tela do vídeo,
# 0,907 nesta repetição -- ruído normal entre corridas) e, pra comparação,
# estendida pra iters=120 com steps-per-eval mais fino. Números reais,
# capturados rodando `python3 -m mlx_lm lora` de verdade nesta máquina.
# ---------------------------------------------------------------------------


def rodar_demo_curva_convergencia():
    print()
    print("===== Curva de convergência: o treino de 20 iterações ainda estava caindo? =====\n")

    curva_20_iters = [
        {"iter": 1, "valLoss": 4.752},
        {"iter": 5, "valLoss": 2.923},
        {"iter": 10, "valLoss": 1.567},
        {"iter": 15, "valLoss": 1.173},
        {"iter": 20, "valLoss": 0.907},
    ]
    analise_20 = analisar_curva_convergencia(curva_20_iters)
    print("Repetição das 20 iterações originais (val loss final 0,895 na tela do vídeo, 0,907 aqui -- ruído normal):")
    for m in curva_20_iters:
        print(f"  Iter {m['iter']:>2}: val loss {m['valLoss']:.3f}")
    print(f"  -> melhor iteração: {analise_20['melhorIteracao']} (val loss {analise_20['melhorValLoss']:.3f})")
    print(f"  -> queda relativa entre os 2 últimos pontos medidos: {analise_20['quedaRelativaFinal']:.1%}")
    print(f"  -> ainda caindo forte? {analise_20['aindaCaindoForte']}  (limiar: 3%)")
    print(f"  -> sinal de overfitting? {analise_20['sinalDeOverfitting']}")

    print()
    print("Mesmo treino, estendido pra 120 iterações (pra ver o que 20 iterações não mostra):")
    curva_120_iters = [
        {"iter": 1, "valLoss": 4.752},
        {"iter": 10, "valLoss": 1.533},
        {"iter": 20, "valLoss": 0.916},
        {"iter": 30, "valLoss": 0.687},
        {"iter": 40, "valLoss": 0.624},
        {"iter": 50, "valLoss": 0.536},
        {"iter": 60, "valLoss": 0.553},
        {"iter": 70, "valLoss": 0.513},
        {"iter": 80, "valLoss": 0.504},
        {"iter": 90, "valLoss": 0.474},
        {"iter": 100, "valLoss": 0.485},
        {"iter": 110, "valLoss": 0.496},
        {"iter": 120, "valLoss": 0.520},
    ]
    analise_120 = analisar_curva_convergencia(curva_120_iters)
    for m in curva_120_iters:
        print(f"  Iter {m['iter']:>3}: val loss {m['valLoss']:.3f}")
    print(f"  -> melhor iteração: {analise_120['melhorIteracao']} (val loss {analise_120['melhorValLoss']:.3f})")
    print(f"  -> queda relativa entre os 2 últimos pontos medidos: {analise_120['quedaRelativaFinal']:.1%}")
    print(f"  -> ainda caindo forte? {analise_120['aindaCaindoForte']}  (limiar: 3%)")
    print(f"  -> sinal de overfitting? {analise_120['sinalDeOverfitting']}")
    print()
    print(
        "Conclusão: em iters=20 o val loss ainda estava caindo mais de 20% a cada 5 iterações -- "
        "não é convergência, é subtreino, o treino parou antes de terminar de aprender. Estendendo "
        "pra 120 iterações, o val loss melhora até a iteração 90, e as iterações 100 a 120 já "
        "mostram sinal de piora (early stopping pararia em 90, não em 120)."
    )
    return {"analise20Iters": analise_20, "analise120Iters": analise_120}


if __name__ == "__main__":
    rodar_testes()
    rodar_preparacao_de_verdade()
    rodar_demo_curva_convergencia()

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
