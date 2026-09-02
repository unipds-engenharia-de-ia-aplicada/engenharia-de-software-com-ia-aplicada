"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 3.3

Ferramenta: validacao de hiperparametro ANTES do envio (a Vertex AI nao faz
isso de forma confiavel, ver nota abaixo), comparacao entre hiperparametro
pedido e hiperparametro realmente aplicado por um job ja criado, e leitura
de estatistica real de monitoramento de um job concluido (contagem de
token, distribuicao de token por exemplo).

Descoberta real desta disciplina, feita testando de proposito antes de
gravar: pedir epoch_count=0 (hiperparametro invalido) pra Vertex AI NAO
gera erro rapido e gratuito. A API aceita a criacao do job, ele vai pra
RUNNING de verdade, com o hiperparametro internamente ignorado e
substituido por um default silencioso. So cancelar na mao parou o gasto.
A validacao client-side deste arquivo e a mitigacao real pra esse gap:
pegar o hiperparametro invalido ANTES de qualquer chamada de rede.

Uso: python3 hyperparameter_and_monitoring_tool.py
"""

import json
import subprocess
import urllib.request

REGIAO = "us-central1"
NOME_JOB = "projects/113512199474/locations/us-central1/tuningJobs/4180970763655839744"

FAIXAS_VALIDAS = {
    "epoch_count": {"min": 1, "max": 20},
    "learning_rate_multiplier": {"min": 0.1, "max": 10},
}

total_testes = 0
testes_com_falha = 0


def testar(descricao, fn):
    global total_testes, testes_com_falha
    total_testes += 1
    try:
        fn()
        print(f"  [OK] {descricao}")
    except AssertionError as erro:
        testes_com_falha += 1
        print(f"  [FALHOU] {descricao}")
        print(f"           {erro}")


def validar_hiperparametros(config):
    erros = []
    epoch_count = config.get("epoch_count")
    lr = config.get("learning_rate_multiplier")

    faixa_epoca = FAIXAS_VALIDAS["epoch_count"]
    if not isinstance(epoch_count, int) or isinstance(epoch_count, bool) or not (faixa_epoca["min"] <= epoch_count <= faixa_epoca["max"]):
        erros.append(f"epoch_count deve ser inteiro entre {faixa_epoca['min']} e {faixa_epoca['max']}, recebido: {epoch_count}")

    faixa_lr = FAIXAS_VALIDAS["learning_rate_multiplier"]
    if not isinstance(lr, (int, float)) or isinstance(lr, bool) or not (faixa_lr["min"] <= lr <= faixa_lr["max"]):
        erros.append(f"learning_rate_multiplier deve estar entre {faixa_lr['min']} e {faixa_lr['max']}, recebido: {lr}")

    if erros:
        raise ValueError("Hiperparâmetro inválido, job não enviado:\n  " + "\n  ".join(erros))
    return True


def valores_equivalentes(a, b):
    """Compara dois valores tolerando a diferenca de tipo que a Vertex AI
    introduz de verdade: campos int64 como epoch_count voltam como STRING
    no JSON ("3"), nao como int (3), uma convencao comum de serializacao
    de inteiro de 64 bits em API do Google. Comparacao estrita (!=) falha
    aqui mesmo quando os valores sao iguais. Se os dois lados forem
    numericamente comparaveis, compara como numero; senao, cai pra
    comparacao direta (cobre adapter_size e outros campos nao numericos)."""
    try:
        return float(a) == float(b)
    except (TypeError, ValueError):
        return a == b


def comparar_hiperparametros(pedido, aplicado):
    """Compara o hiperparametro que foi pedido na criacao do job com o que a
    API realmente aplicou. E a checagem que teria pegado o epoch_count=0
    sendo silenciosamente substituido, sem depender da API validar nada."""
    divergencias = []
    for chave, valor_pedido in pedido.items():
        valor_aplicado = aplicado.get(chave)
        if valor_aplicado is None:
            divergencias.append(f"{chave}: pedido {valor_pedido}, aplicado ausente (provavelmente default silencioso do provedor)")
        elif not valores_equivalentes(valor_aplicado, valor_pedido):
            divergencias.append(f"{chave}: pedido {valor_pedido}, aplicado {valor_aplicado}")
    return divergencias


# ==============================================================================
# >>> DAQUI PRA BAIXO: ORQUESTRACAO GOOGLE CLOUD - chamada de rede real <<<
# Exige projeto com billing ativo (aiplatform.googleapis.com). Tudo ACIMA
# desta marca (validacao, comparacao pedido x aplicado) roda 100% local,
# sem tocar rede e sem custo nenhum.
# ==============================================================================


def obter_token_acesso():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def consultar_job_completo(nome_job):
    token = obter_token_acesso()
    url = f"https://{REGIAO}-aiplatform.googleapis.com/v1/{nome_job}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resposta:
        return json.loads(resposta.read())


def resumir_estatistica_treino(job):
    stats = (job.get("tuningDataStats") or {}).get("supervisedTuningDataStats")
    if not stats:
        return None
    entrada = stats.get("userInputTokenDistribution", {})
    saida = stats.get("userOutputTokenDistribution", {})
    return {
        "exemplos": stats.get("tuningDatasetExampleCount"),
        "tokens_cobraveis": stats.get("totalBillableTokenCount"),
        "entrada_media": entrada.get("mean"),
        "entrada_mediana": entrada.get("median"),
        "entrada_min": entrada.get("min"),
        "entrada_max": entrada.get("max"),
        "saida_media": saida.get("mean"),
        "saida_mediana": saida.get("median"),
        "saida_min": saida.get("min"),
        "saida_max": saida.get("max"),
    }


def rodar_testes():
    print("== Testes: validação de hiperparâmetro ==")

    def teste_config_real():
        assert validar_hiperparametros({"epoch_count": 3, "learning_rate_multiplier": 5.0}) is True

    testar("aceita a config real usada no job de produção", teste_config_real)

    def teste_epoch_zero():
        try:
            validar_hiperparametros({"epoch_count": 0, "learning_rate_multiplier": 5.0})
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "epoch_count deve ser inteiro entre 1 e 20" in str(e)

    testar("rejeita o epoch_count=0 que escapou da API de verdade", teste_epoch_zero)

    def teste_epoch_negativo():
        try:
            validar_hiperparametros({"epoch_count": -3, "learning_rate_multiplier": 1})
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "epoch_count" in str(e)

    testar("rejeita épocas negativas", teste_epoch_negativo)

    def teste_epoch_nao_inteiro():
        try:
            validar_hiperparametros({"epoch_count": 2.5, "learning_rate_multiplier": 1})
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "epoch_count" in str(e)

    testar("rejeita épocas não inteiras", teste_epoch_nao_inteiro)

    def teste_lr_fora_faixa():
        try:
            validar_hiperparametros({"epoch_count": 3, "learning_rate_multiplier": 50})
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "learning_rate_multiplier" in str(e)

    testar("rejeita learning_rate_multiplier fora da faixa", teste_lr_fora_faixa)

    print()
    print("== Testes: comparação pedido vs aplicado ==")

    def teste_sem_divergencia():
        divergencias = comparar_hiperparametros({"epoch_count": 3}, {"epoch_count": 3})
        assert len(divergencias) == 0

    testar("nenhuma divergência quando tudo bate", teste_sem_divergencia)

    def teste_caso_real():
        divergencias = comparar_hiperparametros({"epoch_count": 0}, {"epoch_count": None})
        assert len(divergencias) == 1
        assert "default silencioso" in divergencias[0]

    testar("detecta o caso real: epoch_count pedido, aplicado ausente", teste_caso_real)

    def teste_divergencia_valor():
        divergencias = comparar_hiperparametros({"epoch_count": 3}, {"epoch_count": 5})
        assert len(divergencias) == 1

    testar("detecta divergência de valor numérico", teste_divergencia_valor)

    def teste_tipo_diferente():
        divergencias = comparar_hiperparametros(
            {"epoch_count": 3, "learning_rate_multiplier": 5}, {"epoch_count": "3", "learning_rate_multiplier": "5"}
        )
        assert len(divergencias) == 0

    testar("não aponta divergência quando o valor é igual mas em tipo diferente (bug real: API devolve string)", teste_tipo_diferente)

    print()
    print(f"Total: {total_testes} teste(s), {total_testes - testes_com_falha} passou(passaram), {testes_com_falha} falhou(falharam).")


def main():
    rodar_testes()

    print()
    print("== Reprodução do problema real encontrado antes de gravar ==")
    print("Pedido: epoch_count=0, learning_rate_multiplier=5.0")
    try:
        validar_hiperparametros({"epoch_count": 0, "learning_rate_multiplier": 5.0})
    except ValueError as erro:
        print(f"Bloqueado ANTES de qualquer chamada de rede: {erro}")
    print("Sem esta validação, a chamada real a client.tunings.tune() com epoch_count=0 foi aceita")
    print("pela Vertex AI, criou o job tuningJobs/2893240337390632960, foi pra RUNNING de verdade,")
    print("com epoch_count internamente ausente (default silencioso), e precisou ser cancelado na mão.")

    print()
    print("== Monitoramento real: estatística do job de produção ==")
    print(f"Job: {NOME_JOB}")

    try:
        job = consultar_job_completo(NOME_JOB)
        aplicado = job.get("supervisedTuningSpec", {}).get("hyperParameters", {})
        print(f"\nHiperparâmetro aplicado de verdade: epoch_count={aplicado.get('epochCount')}, learning_rate_multiplier={aplicado.get('learningRateMultiplier')}, adapter_size={aplicado.get('adapterSize')}")

        divergencias = comparar_hiperparametros(
            {"epoch_count": 3, "learning_rate_multiplier": 5.0},
            {"epoch_count": aplicado.get("epochCount"), "learning_rate_multiplier": aplicado.get("learningRateMultiplier")},
        )
        print("Confirmado: pedido e aplicado batem exatamente." if not divergencias else f"Divergências: {'; '.join(divergencias)}")

        resumo = resumir_estatistica_treino(job)
        if resumo:
            print("\nEstatística real do dataset de treino:")
            print(f"  Exemplos: {resumo['exemplos']}")
            print(f"  Tokens cobráveis no total: {resumo['tokens_cobraveis']}")
            print(f"  Token de entrada por exemplo: média {resumo['entrada_media']}, mediana {resumo['entrada_mediana']}, min {resumo['entrada_min']}, max {resumo['entrada_max']}")
            print(f"  Token de saída por exemplo: média {resumo['saida_media']}, mediana {resumo['saida_mediana']}, min {resumo['saida_min']}, max {resumo['saida_max']}")
    except Exception as erro:
        print(f"Não foi possível consultar o job agora: {erro}")


if __name__ == "__main__":
    main()

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
