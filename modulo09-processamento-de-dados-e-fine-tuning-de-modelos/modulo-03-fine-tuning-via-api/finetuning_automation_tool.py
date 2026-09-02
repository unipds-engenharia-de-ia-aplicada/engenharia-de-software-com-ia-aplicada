"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 3.4

Ferramenta: automacao em Python (espelho do JS) do processo completo de
fine-tuning via API: upload do dataset, criacao do job com hiperparametro
validado, e acompanhamento sozinho ate o job terminar, sem comando manual
a cada etapa.

A criacao de job (criar_job_fine_tuning) tem uma trava de confirmacao
explicita, confirmar=True, sem a qual ela nunca chama a rede. Essa trava
existe por causa do incidente real do Modulo 3.3: a Vertex AI aceitou
hiperparametro invalido sem erro rapido e comecou a treinar de verdade.
Automacao sem trava de confirmacao teria disparado o mesmo problema de
novo, agora sem ninguem olhando o terminal.

A demo principal NAO cria job novo: reusa o job real do Modulo 3.2 pra
provar o acompanhamento sozinho de ponta a ponta.

Uso: python3 finetuning_automation_tool.py

Nota de validade (ago/2026): os exemplos de job usam gemini-2.5-flash como
base_model. O processo de automacao -- upload, criacao de job com trava de
confirmacao, acompanhamento -- e o mesmo independente da versao exata do
modelo. A Google aposenta versoes do Gemini com aviso previo (a familia
2.5 tem retirement anunciado pra 16/out/2026); antes de rodar voce mesmo,
confira em
https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes
quais modelos estao disponiveis no momento e troque base_model.
"""

import asyncio
import json
import subprocess
import urllib.request

PROJETO = "amplitude-seguros-demo"
REGIAO = "us-central1"
JOB_REAL_M32 = "projects/113512199474/locations/us-central1/tuningJobs/4180970763655839744"

FAIXAS_VALIDAS = {
    "epoch_count": {"min": 1, "max": 20},
    "learning_rate_multiplier": {"min": 0.1, "max": 10},
}

ESTADOS_TERMINAIS = {"JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED"}

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


async def testar_assincrono(descricao, fn):
    global total_testes, testes_com_falha
    total_testes += 1
    try:
        await fn()
        print(f"  [OK] {descricao}")
    except AssertionError as erro:
        testes_com_falha += 1
        print(f"  [FALHOU] {descricao}")
        print(f"           {erro}")


def converter_para_formato_gemini(exemplo):
    if not exemplo.get("instrucao") or not exemplo.get("entrada") or not isinstance(exemplo.get("saida"), dict):
        raise ValueError("exemplo incompleto: instrucao, entrada e saida são obrigatórios")
    return {
        "contents": [
            {"role": "user", "parts": [{"text": f"{exemplo['instrucao']}\n\n{exemplo['entrada']}"}]},
            {"role": "model", "parts": [{"text": json.dumps(exemplo["saida"], ensure_ascii=False)}]},
        ]
    }


def validar_hiperparametros(config):
    erros = []
    epoch_count = config.get("epoch_count")
    lr = config.get("learning_rate_multiplier")
    faixa_epoca = FAIXAS_VALIDAS["epoch_count"]
    if not isinstance(epoch_count, int) or isinstance(epoch_count, bool) or not (faixa_epoca["min"] <= epoch_count <= faixa_epoca["max"]):
        erros.append(f"epoch_count fora da faixa 1-20: {epoch_count}")
    faixa_lr = FAIXAS_VALIDAS["learning_rate_multiplier"]
    if not isinstance(lr, (int, float)) or isinstance(lr, bool) or not (faixa_lr["min"] <= lr <= faixa_lr["max"]):
        erros.append(f"learning_rate_multiplier fora da faixa 0.1-10: {lr}")
    if erros:
        raise ValueError("Hiperparâmetro inválido:\n  " + "\n  ".join(erros))
    return True


# ==============================================================================
# >>> DAQUI PRA BAIXO: ORQUESTRAÇÃO GOOGLE CLOUD - chamada de rede real <<<
# Exige projeto com billing ativo (aiplatform.googleapis.com). Tudo ACIMA
# desta marca (conversão, validação) roda 100% local, sem tocar rede e sem
# custo nenhum.
# ==============================================================================


def montar_comando_upload(caminho_local, uri_gcs):
    if not caminho_local.endswith(".jsonl"):
        raise ValueError("dataset precisa ser .jsonl")
    if not uri_gcs.startswith("gs://"):
        raise ValueError("destino precisa ser um URI gs://")
    return f'gsutil cp "{caminho_local}" "{uri_gcs}"'


def executar_upload(caminho_local, uri_gcs):
    comando = montar_comando_upload(caminho_local, uri_gcs)
    subprocess.run(comando, shell=True, check=True)
    return uri_gcs


def exigir_confirmacao(opcoes):
    if not opcoes or opcoes.get("confirmar") is not True:
        raise PermissionError(
            "criar_job_fine_tuning bloqueado: passe confirmar=True explicitamente pra criar job de verdade. "
            "Trava adicionada depois do incidente do Módulo 3.3, onde hiperparâmetro inválido criou job real sem aviso."
        )


def obter_token_acesso():
    return subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()


def criar_job_fine_tuning(config, opcoes):
    exigir_confirmacao(opcoes)
    validar_hiperparametros(config)

    token = obter_token_acesso()
    url = f"https://{REGIAO}-aiplatform.googleapis.com/v1/projects/{PROJETO}/locations/{REGIAO}/tuningJobs"
    corpo = {
        "baseModel": config["base_model"],
        "tunedModelDisplayName": config["display_name"],
        "supervisedTuningSpec": {
            "trainingDatasetUri": config["uri_dataset"],
            "hyperParameters": {
                "epochCount": config["epoch_count"],
                "learningRateMultiplier": config["learning_rate_multiplier"],
            },
        },
    }
    req = urllib.request.Request(
        url, data=json.dumps(corpo).encode(), method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resposta:
        return json.loads(resposta.read())


def calcular_proximo_intervalo(atual_ms, fator, maximo_ms):
    return min(round(atual_ms * fator), maximo_ms)


def consultar_status_job(nome_job):
    token = obter_token_acesso()
    url = f"https://{REGIAO}-aiplatform.googleapis.com/v1/{nome_job}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resposta:
        return json.loads(resposta.read())


async def consultar_com_retry(consultar_fn, nome_job, tentativas=3, atraso_ms=3000, esperar_fn=None):
    """Chama consultar_fn(nome_job) com retry limitado: uma falha transiente
    de rede (timeout, 503, conexao resetada) nao pode derrubar uma automacao
    que fica rodando sozinha por ate ~1h40min sem ninguem olhando o terminal.
    So desiste e propaga o erro depois de `tentativas` falhas seguidas.

    Isso NAO e o mesmo principio da trava de confirmacao. A trava valida
    ANTES de qualquer chamada de rede e nunca e reexecutada: "validar antes,
    nunca depois". O retry age DEPOIS que a chamada ja foi autorizada, so pra
    absorver instabilidade de rede numa consulta de leitura -- ele nunca
    repete nem contorna a validacao de hiperparametro ou a trava de
    confirmacao, que continuam falhando rapido e uma unica vez."""
    if esperar_fn is None:
        esperar_fn = asyncio.sleep

    ultimo_erro = None
    for tentativa in range(1, tentativas + 1):
        try:
            return await _talvez_async(consultar_fn, nome_job)
        except Exception as erro:  # noqa: BLE001 - falha transiente de rede, tratada por retry
            ultimo_erro = erro
            if tentativa < tentativas:
                await _talvez_async(esperar_fn, atraso_ms / 1000)
    raise ultimo_erro


async def acompanhar_ate_finalizar(
    nome_job,
    intervalo_inicial_ms=5000,
    fator_backoff=1.5,
    intervalo_maximo_ms=60000,
    ao_atualizar=lambda job: None,
    consultar_fn=None,
    esperar_fn=None,
    tentativas_consulta=3,
    atraso_retry_ms=3000,
):
    """Consulta o job repetidamente ate ele chegar num estado terminal, com
    backoff exponencial entre tentativas. consultar_fn/esperar_fn sao
    injetaveis pra permitir teste unitario real sem rede nem espera. Cada
    consulta passa por consultar_com_retry, entao uma falha transiente
    isolada nao interrompe o acompanhamento inteiro."""
    if consultar_fn is None:
        consultar_fn = lambda nome: consultar_status_job(nome)
    if esperar_fn is None:
        esperar_fn = asyncio.sleep

    intervalo = intervalo_inicial_ms
    job = await consultar_com_retry(
        consultar_fn, nome_job, tentativas=tentativas_consulta, atraso_ms=atraso_retry_ms, esperar_fn=esperar_fn
    )
    ao_atualizar(job)

    while job.get("state") not in ESTADOS_TERMINAIS:
        await _talvez_async(esperar_fn, intervalo / 1000)
        intervalo = calcular_proximo_intervalo(intervalo, fator_backoff, intervalo_maximo_ms)
        job = await consultar_com_retry(
            consultar_fn, nome_job, tentativas=tentativas_consulta, atraso_ms=atraso_retry_ms, esperar_fn=esperar_fn
        )
        ao_atualizar(job)

    return job


async def _talvez_async(fn, arg):
    resultado = fn(arg)
    if asyncio.iscoroutine(resultado):
        return await resultado
    return resultado


async def automatizar_fine_tuning(exemplos, config, opcoes=None):
    """Encadeia converter -> validar -> subir -> criar job -> acompanhar,
    na ordem que o video descreve, falhando rapido em qualquer passo em vez
    de seguir com estado inconsistente. Cada passo reusa a funcao ja testada
    isolada acima -- esta funcao so orquestra, nao duplica nenhuma logica.

    executar_upload_fn, criar_job_fn e acompanhar_fn sao injetaveis (default:
    as versoes reais) pra permitir teste unitario real do encadeamento, sem
    precisar de rede."""
    opcoes = opcoes or {}
    executar_upload_fn = opcoes.get("executar_upload_fn", executar_upload)
    criar_job_fn = opcoes.get("criar_job_fn", criar_job_fine_tuning)
    acompanhar_fn = opcoes.get("acompanhar_fn", acompanhar_ate_finalizar)
    ao_atualizar = opcoes.get("ao_atualizar", lambda job: None)

    convertidos = [converter_para_formato_gemini(exemplo) for exemplo in exemplos]
    validar_hiperparametros(config)
    executar_upload_fn(config["caminho_local"], config["uri_dataset"])

    job_criado = criar_job_fn(config, opcoes)
    if asyncio.iscoroutine(job_criado):
        job_criado = await job_criado

    job_final = acompanhar_fn(job_criado["name"], ao_atualizar=ao_atualizar)
    if asyncio.iscoroutine(job_final):
        job_final = await job_final

    return {"convertidos": convertidos, "job_criado": job_criado, "job_final": job_final}


def rodar_testes_sincronos():
    print("== Testes: upload ==")

    def teste_comando_upload():
        comando = montar_comando_upload("dataset.jsonl", "gs://bucket/dataset.jsonl")
        assert comando == 'gsutil cp "dataset.jsonl" "gs://bucket/dataset.jsonl"'

    testar("monta comando gsutil cp correto", teste_comando_upload)

    def teste_upload_extensao():
        try:
            montar_comando_upload("dataset.json", "gs://bucket/x.jsonl")
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "jsonl" in str(e)

    testar("rejeita dataset que não é .jsonl", teste_upload_extensao)

    def teste_upload_destino():
        try:
            montar_comando_upload("dataset.jsonl", "/local/path")
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "gs://" in str(e)

    testar("rejeita destino que não é gs://", teste_upload_destino)

    print()
    print("== Testes: trava de confirmação (proteção pós-incidente M3.3) ==")

    def teste_trava_sem_confirmar():
        try:
            exigir_confirmacao({})
            raise AssertionError("deveria ter levantado erro")
        except PermissionError as e:
            assert "confirmar=True" in str(e)

    testar("bloqueia criação de job sem confirmar=True", teste_trava_sem_confirmar)

    def teste_trava_sem_opcoes():
        try:
            exigir_confirmacao(None)
            raise AssertionError("deveria ter levantado erro")
        except PermissionError as e:
            assert "confirmar=True" in str(e)

    testar("bloqueia criação de job sem nenhuma opção", teste_trava_sem_opcoes)

    def teste_trava_confirmado():
        exigir_confirmacao({"confirmar": True})

    testar("permite passar quando confirmar=True está explícito", teste_trava_confirmado)

    print()
    print("== Testes: backoff exponencial de acompanhamento ==")

    def teste_backoff_fator():
        assert calcular_proximo_intervalo(5000, 1.5, 60000) == 7500

    testar("primeiro backoff aplica o fator", teste_backoff_fator)

    def teste_backoff_teto():
        assert calcular_proximo_intervalo(50000, 1.5, 60000) == 60000

    testar("backoff nunca ultrapassa o teto configurado", teste_backoff_teto)

    def teste_backoff_satura():
        intervalo = 5000
        historico = [intervalo]
        for _ in range(8):
            intervalo = calcular_proximo_intervalo(intervalo, 1.5, 60000)
            historico.append(intervalo)
        assert historico[-1] == 60000
        assert historico[1] > historico[0]

    testar("backoff sucessivo cresce e satura no teto", teste_backoff_satura)

    print()
    print("== Testes: conversão e validação reusadas ==")

    def teste_conversao():
        convertido = converter_para_formato_gemini({"instrucao": "x", "entrada": "y", "saida": {"z": 1}})
        assert len(convertido["contents"]) == 2

    testar("conversão reusada continua gerando dois turnos", teste_conversao)

    def teste_validacao():
        try:
            validar_hiperparametros({"epoch_count": 0, "learning_rate_multiplier": 5})
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "epoch_count" in str(e)

    testar("validação reusada continua rejeitando epoch_count inválido", teste_validacao)


async def rodar_testes_assincronos():
    print()
    print("== Testes: loop de acompanhamento (com consulta e espera falsas, sem rede) ==")

    async def teste_terminal_imediato():
        chamadas_consulta = 0
        chamadas_espera = 0

        def consulta_falsa(_nome):
            nonlocal chamadas_consulta
            chamadas_consulta += 1
            return {"state": "JOB_STATE_SUCCEEDED"}

        async def espera_falsa(_segundos):
            nonlocal chamadas_espera
            chamadas_espera += 1

        job_final = await acompanhar_ate_finalizar("job-falso", consultar_fn=consulta_falsa, esperar_fn=espera_falsa)
        assert job_final["state"] == "JOB_STATE_SUCCEEDED"
        assert chamadas_consulta == 1
        assert chamadas_espera == 0

    await testar_assincrono("reconhece estado já terminal na primeira consulta, sem esperar", teste_terminal_imediato)

    async def teste_espera_enquanto_running():
        sequencia = ["JOB_STATE_PENDING", "JOB_STATE_RUNNING", "JOB_STATE_RUNNING", "JOB_STATE_SUCCEEDED"]
        indice = {"i": 0}
        chamadas_espera = {"n": 0}

        def consulta_falsa(_nome):
            estado = sequencia[indice["i"]]
            indice["i"] += 1
            return {"state": estado}

        async def espera_falsa(_segundos):
            chamadas_espera["n"] += 1

        job_final = await acompanhar_ate_finalizar("job-falso", consultar_fn=consulta_falsa, esperar_fn=espera_falsa)
        assert job_final["state"] == "JOB_STATE_SUCCEEDED"
        assert indice["i"] == len(sequencia)
        assert chamadas_espera["n"] == len(sequencia) - 1

    await testar_assincrono("espera e consulta de novo enquanto o job está RUNNING", teste_espera_enquanto_running)

    async def teste_ao_atualizar():
        sequencia = ["JOB_STATE_RUNNING", "JOB_STATE_FAILED"]
        indice = {"i": 0}
        estados_vistos = []

        def consulta_falsa(_nome):
            estado = sequencia[indice["i"]]
            indice["i"] += 1
            return {"state": estado}

        async def espera_falsa(_segundos):
            pass

        await acompanhar_ate_finalizar(
            "job-falso", consultar_fn=consulta_falsa, esperar_fn=espera_falsa,
            ao_atualizar=lambda job: estados_vistos.append(job["state"]),
        )
        assert estados_vistos == sequencia

    await testar_assincrono("chama ao_atualizar em toda consulta, inclusive as intermediárias", teste_ao_atualizar)

    print()
    print("== Testes: orquestração de ponta a ponta (converter -> validar -> subir -> criar job -> acompanhar) ==")

    exemplo_valido = {"instrucao": "x", "entrada": "y", "saida": {"z": 1}}
    config_valida = {
        "base_model": "gemini-2.5-flash", "display_name": "teste", "caminho_local": "dataset.jsonl",
        "uri_dataset": "gs://bucket/dataset.jsonl", "epoch_count": 3, "learning_rate_multiplier": 5.0,
    }

    async def teste_orquestracao_ordem():
        chamadas = []

        def upload_falso(_caminho, uri):
            chamadas.append("upload")
            return uri

        async def criar_job_falso(_config, _opcoes):
            chamadas.append("criarJob")
            return {"name": "tuningJobs/falso"}

        async def acompanhar_falso(_nome, ao_atualizar=None):
            chamadas.append("acompanhar")
            return {"state": "JOB_STATE_SUCCEEDED"}

        resultado = await automatizar_fine_tuning(
            [exemplo_valido], config_valida,
            {"confirmar": True, "executar_upload_fn": upload_falso, "criar_job_fn": criar_job_falso, "acompanhar_fn": acompanhar_falso},
        )
        assert chamadas == ["upload", "criarJob", "acompanhar"]
        assert len(resultado["convertidos"]) == 1
        assert resultado["job_final"]["state"] == "JOB_STATE_SUCCEEDED"

    await testar_assincrono("encadeia os 5 passos na ordem certa e devolve o resultado de cada um", teste_orquestracao_ordem)

    async def teste_orquestracao_exemplo_incompleto():
        chamou_upload = {"v": False}

        def upload_falso(_c, _u):
            chamou_upload["v"] = True

        try:
            await automatizar_fine_tuning(
                [{"instrucao": "x"}], config_valida,
                {"confirmar": True, "executar_upload_fn": upload_falso},
            )
            raise AssertionError("deveria ter levantado ValueError")
        except ValueError as erro:
            assert "obrigatórios" in str(erro)
        assert chamou_upload["v"] is False

    await testar_assincrono(
        "falha rápido se algum exemplo estiver incompleto, antes de validar hiperparâmetro",
        teste_orquestracao_exemplo_incompleto,
    )

    async def teste_orquestracao_hiperparametro_invalido():
        chamou_upload = {"v": False}

        def upload_falso(_c, _u):
            chamou_upload["v"] = True

        config_invalida = {**config_valida, "epoch_count": 0}
        try:
            await automatizar_fine_tuning(
                [exemplo_valido], config_invalida,
                {"confirmar": True, "executar_upload_fn": upload_falso},
            )
            raise AssertionError("deveria ter levantado ValueError")
        except ValueError as erro:
            assert "epoch_count" in str(erro)
        assert chamou_upload["v"] is False

    await testar_assincrono(
        "falha rápido se hiperparâmetro for inválido, antes de subir o dataset",
        teste_orquestracao_hiperparametro_invalido,
    )

    async def teste_orquestracao_trava():
        try:
            await automatizar_fine_tuning(
                [exemplo_valido], config_valida,
                {"executar_upload_fn": lambda _c, _u: None},
            )
            raise AssertionError("deveria ter levantado PermissionError")
        except PermissionError as erro:
            assert "confirmar" in str(erro).lower()

    await testar_assincrono(
        "propaga a trava de confirmação: sem injetar criar_job_fn, usa o criar_job_fine_tuning real e bloqueia sem confirmar=True",
        teste_orquestracao_trava,
    )


async def main():
    rodar_testes_sincronos()
    await rodar_testes_assincronos()
    print()
    print(f"Total: {total_testes} teste(s), {total_testes - testes_com_falha} passou(passaram), {testes_com_falha} falhou(falharam).")

    print()
    print("== Reprodução da trava de confirmação ==")
    try:
        criar_job_fine_tuning(
            {
                "base_model": "gemini-2.5-flash",
                "display_name": "teste-sem-confirmar",
                "uri_dataset": "gs://amplitude-seguros-demo-tuning/m3-amplitude-auto-saude-200.jsonl",
                "epoch_count": 3,
                "learning_rate_multiplier": 5.0,
            },
            {},
        )
    except PermissionError as erro:
        print(f"Bloqueado como esperado: {erro}")

    print()
    print("== Acompanhamento sozinho, ao vivo, contra o job real do Módulo 3.2 ==")
    print(f"Job: {JOB_REAL_M32}")
    try:
        job_final = await acompanhar_ate_finalizar(
            JOB_REAL_M32,
            ao_atualizar=lambda job: print(f"  consulta: estado={job.get('state')}"),
        )
        print(f"Acompanhamento terminou sozinho. Estado final: {job_final.get('state')}")
        tuned_model = job_final.get("tunedModel")
        if tuned_model:
            print(f"Endpoint: {tuned_model.get('endpoint')}")
    except Exception as erro:
        print(f"Não foi possível acompanhar agora: {erro}")


if __name__ == "__main__":
    asyncio.run(main())

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
