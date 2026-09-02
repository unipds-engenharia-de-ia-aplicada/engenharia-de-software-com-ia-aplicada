"""
Ahirton Lopes - Fine-Tuning Toolkit
Extra - Dataset real alternativo, parte 2/2 (companion dos Modulos 3.2-3.4,
referencia espelhada em Python)

Ferramenta: converte o dataset real ja preparado (ver
dolly_dataset_real_starter.py, parte 1/2, conceitualmente equivalente ao
Modulo 2.2) pro formato Vertex AI, sobe pro bucket, cria um job de
fine-tuning REAL, acompanha ate finalizar, e roda uma inferencia real
contra o endpoint resultante. Mesmo padrao de conversao do Modulo 3.2
(converter_para_formato_gemini), mesma trava de confirmacao e mesmo loop
de acompanhamento com backoff do Modulo 3.4 (criar_job_fine_tuning,
acompanhar_ate_finalizar).

Diferenca real de adaptacao: a conversao do Modulo 3.2/3.4 faz
json.dumps(exemplo["saida"]) porque o case Amplitude sempre extrai campo
estruturado (saida e dict). O Dolly-15k tem resposta em texto solto
(saida e string) - a conversao aqui usa o texto direto, sem json.dumps,
senao a resposta esperada do modelo sairia com aspas duplas extras em
volta.

Rodado de verdade em 25/08/2026 contra o projeto amplitude-seguros-demo:
job criado, monitorado ate o fim, resultado real documentado no
companion.md e na Missao Pratica #03 (Modulo 3.5).

Nota de validade (ago/2026): validado com gemini-2.5-flash, passado como
config["baseModel"] pra rodar_pipeline (nao e uma constante de topo de
arquivo -- o modelo e parametro, nao fixo, veja o exemplo de config na
suite de teste, rodar_testes, mais abaixo). A Google aposenta versoes do
Gemini com aviso previo (a familia 2.5 tem retirement anunciado pra
16/out/2026); antes de rodar voce mesmo, confira em
https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes
quais modelos estao disponiveis no momento e troque o valor de baseModel
que voce passar.
"""

import asyncio
import json
import subprocess
import urllib.error
import urllib.request

PROJETO = "amplitude-seguros-demo"
REGIAO = "us-central1"


# -----------------------------------------------------------------------
# 1. Conversao (adaptada do Modulo 3.2/3.4: saida do Dolly e texto, nao objeto)
# -----------------------------------------------------------------------

def converter_para_formato_gemini(exemplo):
    saida = exemplo.get("saida")
    if not exemplo.get("instrucao") or not exemplo.get("entrada") or not isinstance(saida, str) or not saida.strip():
        raise ValueError("exemplo incompleto: instrucao, entrada e saida (texto) sao obrigatorios")
    return {
        "contents": [
            {"role": "user", "parts": [{"text": f"{exemplo['instrucao']}\n\n{exemplo['entrada']}"}]},
            {"role": "model", "parts": [{"text": saida}]},
        ]
    }


# -----------------------------------------------------------------------
# >>> DAQUI PRA BAIXO (SECOES 2-6): ORQUESTRACAO GOOGLE CLOUD - chamada de
# rede real. Exige projeto com billing ativo (aiplatform.googleapis.com).
# A SECAO 1 acima (conversao) roda 100% local, sem tocar rede e sem custo
# nenhum - assim como a Parte 1/2 inteira (dolly_dataset_real_starter),
# que fica antes desta.
# -----------------------------------------------------------------------

# -----------------------------------------------------------------------
# 2. Upload
# -----------------------------------------------------------------------

def montar_comando_upload(caminho_local, uri_gcs):
    if not caminho_local.endswith(".jsonl"):
        raise ValueError("dataset precisa ser .jsonl")
    if not uri_gcs.startswith("gs://"):
        raise ValueError("destino precisa ser um URI gs://")
    return f'gsutil cp "{caminho_local}" "{uri_gcs}"'


def executar_upload(caminho_local, uri_gcs):
    subprocess.run(montar_comando_upload(caminho_local, uri_gcs), shell=True, check=True)
    return uri_gcs


# -----------------------------------------------------------------------
# 3. Criacao de job, com a mesma trava de confirmacao E validacao de
#    hiperparametro do Modulo 3.4 (achado de painel: a v1 deste arquivo
#    criava job real sem validar hiperparametro antes)
# -----------------------------------------------------------------------

FAIXAS_VALIDAS = {
    "epochCount": {"min": 1, "max": 20},
    "learningRateMultiplier": {"min": 0.1, "max": 10},
}


def validar_hiperparametros(config):
    erros = []
    epoch_count = config.get("epochCount")
    if not isinstance(epoch_count, int) or isinstance(epoch_count, bool) or not (FAIXAS_VALIDAS["epochCount"]["min"] <= epoch_count <= FAIXAS_VALIDAS["epochCount"]["max"]):
        erros.append(f"epochCount fora da faixa 1-20: {epoch_count}")
    lr = config.get("learningRateMultiplier")
    if not isinstance(lr, (int, float)) or isinstance(lr, bool) or not (FAIXAS_VALIDAS["learningRateMultiplier"]["min"] <= lr <= FAIXAS_VALIDAS["learningRateMultiplier"]["max"]):
        erros.append(f"learningRateMultiplier fora da faixa 0.1-10: {lr}")
    if erros:
        raise ValueError("Hiperparametro invalido:\n  " + "\n  ".join(erros))
    return True


def exigir_confirmacao(opcoes):
    if not opcoes or opcoes.get("confirmar") is not True:
        raise ValueError(
            "criar_job_fine_tuning bloqueado: passe confirmar=True explicitamente pra criar job de verdade (cobra da conta GCP)."
        )


_token_cache = {"valor": None, "expira_em": 0}


def obter_token_acesso(forcar_novo=False):
    """Cache de token (achado de painel: v1 chamava gcloud a cada consulta do
    loop de polling, sem necessidade - o token dura ~1h). Renova com 5min de margem."""
    import time
    agora = time.time()
    if not forcar_novo and _token_cache["valor"] and agora < _token_cache["expira_em"]:
        return _token_cache["valor"]
    token = subprocess.run(
        ["gcloud", "auth", "print-access-token"], capture_output=True, text=True, check=True
    ).stdout.strip()
    _token_cache["valor"] = token
    _token_cache["expira_em"] = agora + 55 * 60
    return token


def _com_token_valido(chamar_fn):
    """Refaz UMA chamada com token forcadamente novo se a primeira tentativa
    voltar 401 (achado real: cache de token pode ficar invalido antes da
    janela de 55min por motivo alheio ao script - revogacao, rotacao de
    credencial, relogio do host. Sem isso, todo retry repete a mesma falha)."""
    token1 = obter_token_acesso()
    try:
        return chamar_fn(token1)
    except urllib.error.HTTPError as erro:
        if erro.code != 401:
            raise
        token2 = obter_token_acesso(forcar_novo=True)
        return chamar_fn(token2)


def _post_json(url, corpo, token):
    dados = json.dumps(corpo).encode("utf-8")
    req = urllib.request.Request(url, data=dados, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _get_json(url, token):
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def criar_job_fine_tuning(config, opcoes):
    exigir_confirmacao(opcoes)
    validar_hiperparametros(config)
    url = f"https://{REGIAO}-aiplatform.googleapis.com/v1/projects/{PROJETO}/locations/{REGIAO}/tuningJobs"
    corpo = {
        "baseModel": config["baseModel"],
        "tunedModelDisplayName": config["displayName"],
        "supervisedTuningSpec": {
            "trainingDatasetUri": config["uriDataset"],
            "hyperParameters": {
                "epochCount": config["epochCount"],
                "learningRateMultiplier": config["learningRateMultiplier"],
            },
        },
    }
    return _com_token_valido(lambda token: _post_json(url, corpo, token))


# -----------------------------------------------------------------------
# 4. Acompanhamento com backoff (mesma logica do Modulo 3.4)
# -----------------------------------------------------------------------

ESTADOS_TERMINAIS = {"JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED"}


def consultar_status_job(nome_job):
    url = f"https://{REGIAO}-aiplatform.googleapis.com/v1/{nome_job}"
    return _com_token_valido(lambda token: _get_json(url, token))


def calcular_proximo_intervalo(atual_ms, fator, maximo_ms):
    return min(round(atual_ms * fator), maximo_ms)


async def consultar_com_retry(consultar_fn, nome_job, tentativas=3, atraso_ms=3000, esperar_fn=None):
    """Retry limitado (achado de painel: v1 nao tinha isso - uma falha
    transiente de rede num job de 13min matava o acompanhamento inteiro)."""
    esperar_fn = esperar_fn or (lambda ms: asyncio.sleep(ms / 1000))
    ultimo_erro = None
    for tentativa in range(1, tentativas + 1):
        try:
            return await _talvez_async(consultar_fn, nome_job)
        except Exception as erro:
            ultimo_erro = erro
            if tentativa < tentativas:
                await _talvez_async(esperar_fn, atraso_ms)
    raise ultimo_erro


async def acompanhar_ate_finalizar(
    nome_job,
    intervalo_inicial_ms=15000,
    fator_backoff=1.3,
    intervalo_maximo_ms=60000,
    ao_atualizar=lambda job: None,
    consultar_fn=None,
    esperar_fn=None,
    tentativas_consulta=3,
    atraso_retry_ms=3000,
):
    consultar_fn = consultar_fn or (lambda nome: consultar_status_job(nome))
    esperar_fn = esperar_fn or (lambda ms: asyncio.sleep(ms / 1000))

    intervalo = intervalo_inicial_ms
    job = await consultar_com_retry(consultar_fn, nome_job, tentativas_consulta, atraso_retry_ms, esperar_fn)
    ao_atualizar(job)
    while job["state"] not in ESTADOS_TERMINAIS:
        await _talvez_async(esperar_fn, intervalo)
        intervalo = calcular_proximo_intervalo(intervalo, fator_backoff, intervalo_maximo_ms)
        job = await consultar_com_retry(consultar_fn, nome_job, tentativas_consulta, atraso_retry_ms, esperar_fn)
        ao_atualizar(job)
    return job


async def _talvez_async(fn, arg):
    resultado = fn(arg)
    if asyncio.iscoroutine(resultado):
        return await resultado
    return resultado


# -----------------------------------------------------------------------
# 5. Inferencia real contra o endpoint resultante
# -----------------------------------------------------------------------

def rodar_inferencia(endpoint_nome, texto_usuario, generation_config=None):
    # temperature=0 (achado de painel: v1 nao documentava sampling; geracao e
    # estocastica, e sem isso o mesmo teste nao e reproduzivel de novo)
    generation_config = generation_config if generation_config is not None else {"temperature": 0}
    url = f"https://{REGIAO}-aiplatform.googleapis.com/v1/{endpoint_nome}:generateContent"
    corpo = {"contents": [{"role": "user", "parts": [{"text": texto_usuario}]}], "generationConfig": generation_config}
    return _com_token_valido(lambda token: _post_json(url, corpo, token))


# -----------------------------------------------------------------------
# 6. Orquestracao completa (mesmo formato do automatizar_fine_tuning do Modulo 3.4)
# -----------------------------------------------------------------------

async def rodar_pipeline(exemplos, config, opcoes=None):
    opcoes = opcoes or {}
    executar_upload_fn = opcoes.get("executar_upload_fn", executar_upload)
    criar_job_fn = opcoes.get("criar_job_fn", criar_job_fine_tuning)
    acompanhar_fn = opcoes.get("acompanhar_fn", acompanhar_ate_finalizar)
    ao_atualizar = opcoes.get("ao_atualizar", lambda job: None)

    convertidos = [converter_para_formato_gemini(e) for e in exemplos]
    with open(config["caminho_local"], "w", encoding="utf-8") as f:
        f.write("\n".join(json.dumps(c) for c in convertidos) + "\n")
    await _talvez_async(lambda _: executar_upload_fn(config["caminho_local"], config["uriDataset"]), None)
    job_criado = await _talvez_async(lambda _: criar_job_fn(config, opcoes), None)
    job_final = await acompanhar_fn(job_criado["name"], ao_atualizar=ao_atualizar)

    return {"convertidos": convertidos, "job_criado": job_criado, "job_final": job_final}


# -----------------------------------------------------------------------
# Testes automatizados (sem rede real, funcoes injetadas)
# -----------------------------------------------------------------------

_total_testes = 0
_testes_com_falha = 0


def _testar(descricao, fn):
    global _total_testes, _testes_com_falha
    _total_testes += 1
    try:
        fn()
        print(f"  [OK] {descricao}")
    except AssertionError as erro:
        _testes_com_falha += 1
        print(f"  [FALHOU] {descricao}")
        print(f"           {erro}")


async def _testar_async(descricao, fn):
    global _total_testes, _testes_com_falha
    _total_testes += 1
    try:
        await fn()
        print(f"  [OK] {descricao}")
    except AssertionError as erro:
        _testes_com_falha += 1
        print(f"  [FALHOU] {descricao}")
        print(f"           {erro}")


def _assert(condicao, msg="assercao falhou"):
    if not condicao:
        raise AssertionError(msg)


async def rodar_testes():
    print("== Testes: conversao (saida texto, nao objeto) ==")

    def _t1():
        r = converter_para_formato_gemini({"instrucao": "Pergunta", "entrada": "Contexto", "saida": "Resposta em texto puro"})
        _assert(r["contents"][0]["role"] == "user")
        _assert(r["contents"][1]["role"] == "model")
        _assert(r["contents"][1]["parts"][0]["text"] == "Resposta em texto puro")

    _testar("converte instrucao+entrada+saida (texto) em dois turnos user/model", _t1)

    def _t2():
        r = converter_para_formato_gemini({"instrucao": "x", "entrada": "y", "saida": "texto simples"})
        _assert(not r["contents"][1]["parts"][0]["text"].startswith('"'), "saida nao deveria vir entre aspas de json.dumps")

    _testar("NAO faz json.dumps na saida (diferente do Modulo 3.2/3.4, que espera objeto)", _t2)

    def _t3():
        try:
            converter_para_formato_gemini({"instrucao": "x", "entrada": "y", "saida": {"a": 1}})
            _assert(False, "deveria ter rejeitado saida como objeto")
        except ValueError:
            pass

    _testar("rejeita exemplo com saida como objeto (esse pipeline e so pra saida-texto)", _t3)

    def _t4():
        for incompleto in [
            {"entrada": "y", "saida": "z"},
            {"instrucao": "x", "saida": "z"},
            {"instrucao": "x", "entrada": "y"},
        ]:
            try:
                converter_para_formato_gemini(incompleto)
                _assert(False, f"deveria ter rejeitado {incompleto}")
            except ValueError:
                pass

    _testar("rejeita exemplo sem instrucao/entrada/saida", _t4)

    print("\n== Testes: trava de confirmacao (mesma do Modulo 3.4) ==")

    async def _t5():
        try:
            criar_job_fine_tuning({}, {})
            _assert(False, "deveria ter bloqueado sem confirmar=True")
        except ValueError as e:
            _assert("bloqueado" in str(e))

    await _testar_async("bloqueia criacao de job sem confirmar=True", _t5)

    async def _t5b():
        try:
            criar_job_fine_tuning({"epochCount": 0, "learningRateMultiplier": 5}, {"confirmar": True})
            _assert(False, "deveria ter bloqueado hiperparametro invalido")
        except ValueError as e:
            _assert("Hiperparametro invalido" in str(e))

    await _testar_async("bloqueia job com hiperparametro invalido mesmo com confirmar=True (achado de painel)", _t5b)

    def _t5c():
        _assert(validar_hiperparametros({"epochCount": 3, "learningRateMultiplier": 5}))

    _testar("validar_hiperparametros aceita a config real usada no job (epochCount=3, learningRateMultiplier=5)", _t5c)

    print("\n== Testes: acompanhamento com backoff, sem rede real ==")

    async def _t6():
        job_final = await acompanhar_ate_finalizar(
            "job-fake",
            consultar_fn=lambda nome: {"state": "JOB_STATE_SUCCEEDED"},
            esperar_fn=lambda ms: None,
        )
        _assert(job_final["state"] == "JOB_STATE_SUCCEEDED")

    await _testar_async("para no primeiro estado terminal, sem esperar", _t6)

    async def _t7():
        estados = ["JOB_STATE_PENDING", "JOB_STATE_RUNNING", "JOB_STATE_RUNNING", "JOB_STATE_SUCCEEDED"]
        contador = {"i": 0}

        def consultar_fn(nome):
            job = {"state": estados[contador["i"]]}
            contador["i"] += 1
            return job

        esperas = []
        job_final = await acompanhar_ate_finalizar(
            "job-fake",
            consultar_fn=consultar_fn,
            esperar_fn=lambda ms: esperas.append(ms),
            intervalo_inicial_ms=1000,
            fator_backoff=2,
        )
        _assert(job_final["state"] == "JOB_STATE_SUCCEEDED")
        _assert(esperas == [1000, 2000, 4000], f"esperas inesperadas: {esperas}")

    await _testar_async("consulta repetidamente ate estado terminal, respeitando backoff", _t7)

    print("\n== Testes: pipeline completo, orquestracao encadeada, sem rede real ==")

    async def _t8():
        chamadas = []
        exemplos = [{"instrucao": "x", "entrada": "y", "saida": "resposta"}]
        config = {
            "caminho_local": "/tmp/teste_dolly_pipeline.jsonl",
            "uriDataset": "gs://fake/teste.jsonl",
            "baseModel": "gemini-2.5-flash",
            "displayName": "teste",
            "epochCount": 3,
            "learningRateMultiplier": 1,
        }

        def upload_fn(local, uri):
            chamadas.append(f"upload:{uri}")

        def criar_job_fn(cfg, opcoes):
            chamadas.append("criarJob")
            return {"name": "jobs/fake-123"}

        async def acompanhar_fn(nome, ao_atualizar=lambda job: None):
            chamadas.append(f"acompanhar:{nome}")
            return {"state": "JOB_STATE_SUCCEEDED", "tunedModel": {"endpoint": "endpoints/fake"}}

        r = await rodar_pipeline(
            exemplos, config,
            {
                "confirmar": True,
                "executar_upload_fn": upload_fn,
                "criar_job_fn": criar_job_fn,
                "acompanhar_fn": acompanhar_fn,
            },
        )
        _assert(chamadas == ["upload:gs://fake/teste.jsonl", "criarJob", "acompanhar:jobs/fake-123"], f"ordem errada: {chamadas}")
        _assert(r["job_final"]["state"] == "JOB_STATE_SUCCEEDED")
        import os
        os.unlink(config["caminho_local"])

    await _testar_async("encadeia converter -> upload -> criar job -> acompanhar, na ordem certa", _t8)

    print(f"\n{_total_testes - _testes_com_falha}/{_total_testes} testes passaram.")


if __name__ == "__main__":
    asyncio.run(rodar_testes())

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
