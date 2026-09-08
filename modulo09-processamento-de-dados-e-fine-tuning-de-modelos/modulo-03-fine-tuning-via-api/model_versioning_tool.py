"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 3.5

Ferramenta: versionamento e documentacao de modelo fine-tunado. Gera uma
ficha de versionamento real, a partir do job de verdade dos Modulos 3.2 a
3.4, com identificador de dataset baseado em conteudo (hash SHA-256, o
mesmo principio de versionamento por conteudo que git e Docker usam), nao
em nome de arquivo ou data, que podem mudar sem o conteudo mudar.

Uso: python3 model_versioning_tool.py

Nota de validade (ago/2026): este script nao tem constante de modelo pra
trocar - ele consulta o job real (JOB_REAL acima) e usa o que a API
devolver (job["baseModel"]), entao sempre reflete a versao de verdade
usada naquele job especifico, nao uma suposicao hardcoded. A Google
aposenta versoes do Gemini com aviso previo (a familia 2.5 tem retirement
anunciado pra 16/out/2026); confira em
https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes
quais modelos tem suporte a fine-tuning supervisionado no momento. Essa
mesma nota tambem sai embutida automaticamente no model card que este
script gera (funcao gerar_model_card, o texto do rodape "Este model card
documenta...").
"""

import hashlib
import json
import os
import subprocess
import urllib.request
from datetime import datetime

REGIAO = "us-central1"
JOB_REAL = "projects/113512199474/locations/us-central1/tuningJobs/4180970763655839744"
CAMINHO_DATASET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dataset-treinado.jsonl")

# Job real de preference tuning (DPO) do Modulo 3.5, continuacao do job SFT
# acima sobre o mesmo modelo base. Historico e congelado (ja concluido em
# 2026-08), por isso e uma constante, nao uma consulta nova a API a cada
# rodada -- ao contrario do job SFT acima, que e sempre revalidado de verdade.
JOB_DPO_REAL = {
    "jobId": "tuningJobs/3733013646142341120",
    "estado": "JOB_STATE_SUCCEEDED",
    "duracaoFormatada": "17min 32s",
    "exemplos": 40,
}

# Faixa de custo de GPU cloud por hora, do cheatsheet do Modulo 1.3
# (fine-tuning-types-cheatsheet.md, secao LoRA): referencia de mercado, nao
# a fatura real do job (Vertex AI cobra por token de treino, nao por hora de GPU).
FAIXA_CUSTO_GPU_CLOUD_USD_HORA = {
    "consumerMin": 0.40,
    "consumerMax": 0.80,
    "h100Min": 2.50,
    "h100Max": 4.00,
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


def calcular_hash_dataset(caminho_arquivo):
    with open(caminho_arquivo, "rb") as f:
        conteudo = f.read()
    return hashlib.sha256(conteudo).hexdigest()


# ==============================================================================
# >>> DAQUI PRA BAIXO: ORQUESTRAÇÃO GOOGLE CLOUD -- chamada de rede real <<<
# Exige projeto com billing ativo (aiplatform.googleapis.com). Tudo ACIMA
# desta marca (hash do dataset) e tudo abaixo da seção de duração/custo/
# ficha/model card roda 100% local, sem tocar rede e sem custo nenhum --
# só esta consulta ao job já criado toca a nuvem de verdade.
# ==============================================================================


def obter_token_acesso():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def consultar_job_completo(nome_job):
    token = obter_token_acesso()
    url = f"https://{REGIAO}-aiplatform.googleapis.com/v1/{nome_job}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resposta:
        return json.loads(resposta.read())


def calcular_duracao_segundos(criado_em, concluido_em):
    inicio = datetime.fromisoformat(criado_em.replace("Z", "+00:00"))
    fim = datetime.fromisoformat(concluido_em.replace("Z", "+00:00"))
    return (fim - inicio).total_seconds()


def formatar_duracao(duracao_segundos):
    minutos = int(duracao_segundos // 60)
    segundos = int(round(duracao_segundos - minutos * 60))
    return f"{minutos}min {segundos}s"


def formatar_usd(valor):
    return f"{valor:.2f}".replace(".", ",")


def formatar_brl(valor):
    return f"{valor:.2f}".replace(".", ",")


def formatar_milhar(numero):
    return f"{numero:,}".replace(",", ".")


# Taxa real apurada no relatorio de billing por SKU de agosto/2026 (conferida
# de novo em 28/08/2026 contra o CSV diario: R$2,39 em 07/08 = exatamente
# 27.353 tokens x 3 epocas do job do Modulo 3.2, linha literal de fatura).
TAXA_REAL_POR_UNIDADE = 0.00002909


def calcular_custo_real(tokens_cobraveis, epoch_count):
    if tokens_cobraveis is None or epoch_count is None:
        return None
    # A API real da Vertex AI devolve esses campos como string (ex.: "27353",
    # "3"), nao int -- sem essa conversao, str * str lanca TypeError.
    unidades = int(tokens_cobraveis) * int(epoch_count)
    return {
        "unidades": unidades,
        "custoReais": round(unidades * TAXA_REAL_POR_UNIDADE, 2),
    }


def calcular_custo_estimado(duracao_segundos):
    duracao_horas = duracao_segundos / 3600
    faixa = FAIXA_CUSTO_GPU_CLOUD_USD_HORA
    return {
        "duracaoSegundos": round(duracao_segundos, 3),
        "duracaoFormatada": formatar_duracao(duracao_segundos),
        "consumerMinUsd": round(duracao_horas * faixa["consumerMin"], 2),
        "consumerMaxUsd": round(duracao_horas * faixa["consumerMax"], 2),
        "h100MinUsd": round(duracao_horas * faixa["h100Min"], 2),
        "h100MaxUsd": round(duracao_horas * faixa["h100Max"], 2),
    }


def gerar_ficha_versionamento(job, hash_dataset):
    if not job or not job.get("name"):
        raise ValueError('job inválido: precisa ter ao menos "name"')
    hiper = (job.get("supervisedTuningSpec") or {}).get("hyperParameters") or {}
    stats = (job.get("tuningDataStats") or {}).get("supervisedTuningDataStats") or {}
    tuned_model = job.get("tunedModel") or {}

    # A API real da Vertex AI devolve epochCount e totalBillableTokenCount
    # como string (serializacao proto3 de int64), nao int. Normaliza aqui,
    # na origem, pra toda a ficha (custo real, exibicao no markdown) usar
    # numero de verdade, nao só o teste com job_falso, que já vem com int.
    epoch_count = hiper.get("epochCount")
    if epoch_count is not None:
        epoch_count = int(epoch_count)
    tokens_cobraveis = stats.get("totalBillableTokenCount")
    if tokens_cobraveis is not None:
        tokens_cobraveis = int(tokens_cobraveis)

    custo_estimado = None
    if job.get("createTime") and job.get("endTime"):
        duracao_segundos = calcular_duracao_segundos(job["createTime"], job["endTime"])
        custo_estimado = calcular_custo_estimado(duracao_segundos)
    custo_real = calcular_custo_real(tokens_cobraveis, epoch_count)

    return {
        "jobId": job["name"],
        "modeloBase": job.get("baseModel"),
        "nomeExibicao": job.get("tunedModelDisplayName"),
        "datasetUri": (job.get("supervisedTuningSpec") or {}).get("trainingDatasetUri"),
        "datasetHashSha256": hash_dataset,
        "hiperparametros": {
            "epochCount": epoch_count,
            "learningRateMultiplier": hiper.get("learningRateMultiplier"),
            "adapterSize": hiper.get("adapterSize"),
        },
        "estatisticaDataset": {
            "exemplos": stats.get("tuningDatasetExampleCount"),
            "tokensCobraveis": tokens_cobraveis,
        },
        "modeloAjustado": tuned_model.get("model"),
        "endpoint": tuned_model.get("endpoint"),
        "criadoEm": job.get("createTime"),
        "concluidoEm": job.get("endTime"),
        "estado": job.get("state"),
        "custoEstimado": custo_estimado,
        "custoReal": custo_real,
    }


def validar_ficha_completa(ficha):
    campos_obrigatorios = ["jobId", "modeloBase", "datasetUri", "datasetHashSha256", "modeloAjustado", "endpoint"]
    faltando = [campo for campo in campos_obrigatorios if not ficha.get(campo)]
    if faltando:
        raise ValueError(f"Ficha de versionamento incompleta, faltam: {', '.join(faltando)}")
    return True


def gerar_model_card_markdown(ficha):
    linhas = [
        "# Model Card, modelo fine-tunado",
        "",
        "## Identificação",
        f"- Job: {ficha['jobId']}",
        f"- Modelo ajustado: {ficha['modeloAjustado']}",
        f"- Endpoint: {ficha['endpoint']}",
        f"- Estado: {ficha['estado']}",
        "",
        "## Linhagem",
        f"- Modelo base: {ficha['modeloBase']}",
        f"- Dataset de treino: {ficha['datasetUri']}",
        f"- Hash SHA-256 do dataset: {ficha['datasetHashSha256']}",
        "",
        "## Hiperparâmetros",
        f"- Épocas: {ficha['hiperparametros']['epochCount']}",
        f"- Taxa de aprendizado (multiplicador): {ficha['hiperparametros']['learningRateMultiplier']}",
        f"- Rank do adaptador (LoRA): {ficha['hiperparametros']['adapterSize']}",
        "",
        "## Estatística do dataset",
        f"- Exemplos de treino: {ficha['estatisticaDataset']['exemplos']}",
        f"- Tokens cobráveis no total: {ficha['estatisticaDataset']['tokensCobraveis']}",
        "",
        "## Linha do tempo",
        f"- Criado em: {ficha['criadoEm']}",
        f"- Concluído em: {ficha['concluidoEm']}",
        "",
    ]

    custo = ficha.get("custoEstimado")
    if custo:
        custo_real = ficha.get("custoReal")
        nota_final = "Nota: a Vertex AI cobra por token de treino, não por hora de GPU alugada; a faixa de GPU acima é referência de mercado pra comparar com o custo de rodar o mesmo tipo de treino (LoRA) em infraestrutura própria, não a fatura real deste job."
        linha_custo_real = None
        if custo_real:
            tokens = ficha["estatisticaDataset"]["tokensCobraveis"]
            epocas = ficha["hiperparametros"]["epochCount"]
            linha_custo_real = (
                f"- **Custo real, conferido no billing do Google Cloud (28/08/2026)**: "
                f"R${formatar_brl(custo_real['custoReais'])} ({formatar_milhar(tokens)} tokens faturáveis "
                f"× {epocas} épocas = {formatar_milhar(custo_real['unidades'])} unidades cobradas, "
                f"à taxa real de R$0,00002909/unidade apurada no relatório de billing por SKU de agosto/2026)"
            )
            nota_final = (
                "Nota: a Vertex AI cobra por token de treino, não por hora de GPU alugada; a faixa de GPU "
                "acima é referência de mercado pra comparar com o custo de rodar o mesmo tipo de treino "
                f"(LoRA) em infraestrutura própria - o valor real deste job específico é o "
                f"R${formatar_brl(custo_real['custoReais'])} conferido no billing, acima."
            )
        linhas += [
            "## Custo real",
            f"- Duração real do job: {custo['duracaoFormatada']}",
            *([linha_custo_real] if linha_custo_real else []),
            f"- Faixa GPU cloud consumer (US$ 0,40-0,80/hora, cheatsheet do Módulo 1.3): US$ {formatar_usd(custo['consumerMinUsd'])}-{formatar_usd(custo['consumerMaxUsd'])}",
            f"- Faixa GPU cloud H100 (US$ 2,50-4,00/hora, cheatsheet do Módulo 1.3): US$ {formatar_usd(custo['h100MinUsd'])}-{formatar_usd(custo['h100MaxUsd'])}",
            nota_final,
            "",
        ]

    linhas += [
        "## Nota de validade (ago/2026)",
        f"Este model card documenta um job real, rodado com {ficha['modeloBase']}. O processo -- upload, hiperparâmetro, versionamento -- é o mesmo independente da versão exata do modelo-base. A Google aposenta versões do Gemini com aviso prévio (a família 2.5 tem retirement anunciado pra 16/out/2026); antes de treinar você mesmo, confira em [Vertex AI release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) quais modelos têm suporte a fine-tuning supervisionado no momento.",
    ]
    return "\n".join(linhas)


def gerar_secao_dpo():
    """Secao fixa sobre o job real de preference tuning (DPO) do Modulo 3.5,
    continuacao do job SFT documentado acima sobre o mesmo modelo base.
    Separada de gerar_model_card_markdown de proposito: aquela funcao e sempre
    gerada a partir de um `job` consultado ao vivo na API (pode mudar de
    conteudo a cada rodada real), esta e um fato historico ja congelado
    (job concluido em 2026-08) que nao depende de nenhuma consulta nova."""
    j = JOB_DPO_REAL
    linhas = [
        "",
        "## Continuação: preference tuning (DPO)",
        "",
        "O Módulo 3.5 vai além do fine-tuning supervisionado acima e testa preference tuning (DPO) sobre o mesmo modelo base: 40 dos 200 exemplos deste job foram convertidos em pares de preferência (`chosen`/`rejected`) - a extração correta de sempre (`chosen`) contra uma resposta real gerada por um prompt deliberadamente mais fraco (`rejected`, sem exigir JSON estrito). O dataset de preferência resultante está em `preference-dataset-amplitude.jsonl`, nesta mesma pasta.",
        "",
        f"- Job: `{j['jobId']}`",
        f"- Estado: {j['estado']}",
        f"- Duração real: {j['duracaoFormatada']} (mais rápido que o SFT acima, dataset 5x menor: {j['exemplos']} exemplos contra 200)",
        f"- Exemplos: {j['exemplos']} pares de preferência",
    ]
    return "\n".join(linhas)


def rodar_testes():
    print("== Testes: hash de conteúdo do dataset ==")

    def teste_hash_deterministico():
        assert calcular_hash_dataset(CAMINHO_DATASET) == calcular_hash_dataset(CAMINHO_DATASET)

    testar("hash do mesmo arquivo, calculado duas vezes, é idêntico", teste_hash_deterministico)

    def teste_hash_formato():
        h = calcular_hash_dataset(CAMINHO_DATASET)
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    testar("hash tem 64 caracteres hexadecimais (SHA-256)", teste_hash_formato)

    def teste_hash_diferente():
        caminho_temp = os.path.join(os.path.dirname(CAMINHO_DATASET), "_teste_hash_temp.jsonl")
        with open(caminho_temp, "w") as f:
            f.write('{"diferente": true}\n')
        hash_original = calcular_hash_dataset(CAMINHO_DATASET)
        hash_diferente = calcular_hash_dataset(caminho_temp)
        os.remove(caminho_temp)
        assert hash_original != hash_diferente

    testar("conteúdo diferente gera hash diferente", teste_hash_diferente)

    print()
    print("== Testes: ficha de versionamento ==")

    job_falso = {
        "name": "projects/x/locations/y/tuningJobs/123",
        "baseModel": "gemini-2.5-flash",
        "tunedModelDisplayName": "teste",
        "state": "JOB_STATE_SUCCEEDED",
        "createTime": "2026-08-08T00:00:00Z",
        "endTime": "2026-08-08T01:00:00Z",
        "supervisedTuningSpec": {
            "trainingDatasetUri": "gs://bucket/dataset.jsonl",
            "hyperParameters": {"epochCount": 3, "learningRateMultiplier": 5, "adapterSize": "ADAPTER_SIZE_FOUR"},
        },
        "tuningDataStats": {
            "supervisedTuningDataStats": {"tuningDatasetExampleCount": 200, "totalBillableTokenCount": 27353}
        },
        "tunedModel": {"model": "projects/x/locations/y/models/999", "endpoint": "projects/x/locations/y/endpoints/888"},
    }

    def teste_ficha_completa():
        ficha = gerar_ficha_versionamento(job_falso, "hash-de-teste")
        assert ficha["jobId"] == job_falso["name"]
        assert ficha["hiperparametros"]["epochCount"] == 3
        assert ficha["datasetHashSha256"] == "hash-de-teste"

    testar("gera ficha completa a partir de um job bem formado", teste_ficha_completa)

    def teste_job_sem_name():
        try:
            gerar_ficha_versionamento({}, "hash")
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "job inválido" in str(e)

    testar("rejeita job sem name", teste_job_sem_name)

    def teste_validacao_aceita():
        ficha = gerar_ficha_versionamento(job_falso, "hash-de-teste")
        assert validar_ficha_completa(ficha) is True

    testar("validação aceita ficha completa", teste_validacao_aceita)

    def teste_validacao_rejeita():
        ficha = gerar_ficha_versionamento(job_falso, "hash-de-teste")
        del ficha["endpoint"]
        try:
            validar_ficha_completa(ficha)
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "endpoint" in str(e)

    testar("validação rejeita ficha com endpoint ausente", teste_validacao_rejeita)

    def teste_custo_estimado_calculado():
        ficha = gerar_ficha_versionamento(job_falso, "hash-de-teste")
        # job_falso dura exatamente 1h (00:00:00Z -> 01:00:00Z): custo = taxa/hora direto
        assert ficha["custoEstimado"]["duracaoFormatada"] == "60min 0s"
        assert ficha["custoEstimado"]["consumerMinUsd"] == 0.40
        assert ficha["custoEstimado"]["consumerMaxUsd"] == 0.80
        assert ficha["custoEstimado"]["h100MinUsd"] == 2.50
        assert ficha["custoEstimado"]["h100MaxUsd"] == 4.00

    testar("custo estimado usa a duração real do job (createTime/endTime)", teste_custo_estimado_calculado)

    def teste_formatar_duracao_job_real():
        # duração real do job de produção desta ficha: 45min42s (02:38:12.307201Z -> 03:23:54.310390Z)
        segundos = calcular_duracao_segundos("2026-08-08T02:38:12.307201Z", "2026-08-08T03:23:54.310390Z")
        assert formatar_duracao(segundos) == "45min 42s"

    testar("formata a duração real de 45min42s do job de produção", teste_formatar_duracao_job_real)

    print()
    print("== Testes: geração do model card ==")

    def teste_card_hash():
        ficha = gerar_ficha_versionamento(job_falso, "hash-de-teste-abc123")
        markdown = gerar_model_card_markdown(ficha)
        assert "hash-de-teste-abc123" in markdown

    testar("model card inclui o hash do dataset", teste_card_hash)

    def teste_card_endpoint():
        ficha = gerar_ficha_versionamento(job_falso, "hash-de-teste")
        markdown = gerar_model_card_markdown(ficha)
        assert job_falso["tunedModel"]["endpoint"] in markdown
        assert job_falso["tunedModel"]["model"] in markdown

    testar("model card inclui endpoint e modelo ajustado", teste_card_endpoint)

    def teste_card_custo_real():
        ficha = gerar_ficha_versionamento(job_falso, "hash-de-teste")
        markdown = gerar_model_card_markdown(ficha)
        assert "## Custo real" in markdown
        assert "R$2,39" in markdown
        assert "82.059 unidades cobradas" in markdown
        assert "US$ 0,40-0,80" in markdown
        assert "US$ 2,50-4,00" in markdown

    testar("model card inclui o custo real, calculado da ficha, e a faixa de GPU de referência", teste_card_custo_real)

    def teste_custo_real_calculado():
        ficha = gerar_ficha_versionamento(job_falso, "hash-de-teste")
        # job_falso: 27.353 tokens x 3 épocas = 82.059 unidades x R$0,00002909 = R$2,39
        assert ficha["custoReal"]["unidades"] == 82059
        assert ficha["custoReal"]["custoReais"] == 2.39

    testar("custo real usa tokens faturáveis x épocas x taxa real do billing", teste_custo_real_calculado)

    def teste_secao_dpo():
        secao = gerar_secao_dpo()
        assert "## Continuação: preference tuning (DPO)" in secao
        assert "tuningJobs/3733013646142341120" in secao
        assert "17min 32s" in secao
        assert "40 pares de preferência" in secao
        assert "preference-dataset-amplitude.jsonl" in secao

    testar("seção de DPO cita o job real de preference tuning do Módulo 3.5", teste_secao_dpo)

    print()
    print(f"Total: {total_testes} teste(s), {total_testes - testes_com_falha} passou(passaram), {testes_com_falha} falhou(falharam).")


def main():
    rodar_testes()

    print()
    print("== Ficha de versionamento real, gerada a partir do job de produção ==")

    hash_dataset = calcular_hash_dataset(CAMINHO_DATASET)
    print(f"Hash SHA-256 do dataset de treino (200 exemplos): {hash_dataset}")

    try:
        job = consultar_job_completo(JOB_REAL)
        ficha = gerar_ficha_versionamento(job, hash_dataset)
        validar_ficha_completa(ficha)

        print("\nFicha completa e validada:")
        print(json.dumps(ficha, indent=2, ensure_ascii=False))

        markdown = gerar_model_card_markdown(ficha) + "\n" + gerar_secao_dpo()
        caminho_saida = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model-card-amplitude-auto-saude-m3-200-py.md")
        with open(caminho_saida, "w") as f:
            f.write(markdown)
        print(f"\nModel card gerado em: {caminho_saida}")
    except Exception as erro:
        print(f"Não foi possível gerar a ficha agora: {erro}")


if __name__ == "__main__":
    main()

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
