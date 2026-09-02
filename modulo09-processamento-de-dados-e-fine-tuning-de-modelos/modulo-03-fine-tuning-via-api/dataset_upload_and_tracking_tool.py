"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 3.2

Ferramenta: Conversao do schema canonico pro formato de fine-tuning
supervisionado da Vertex AI / Gemini Enterprise Agent Platform
(contents/role/parts), e acompanhamento real de job via a API REST
do aiplatform.googleapis.com.

O job consultado aqui ja rodou de verdade antes desta gravacao:
tuningJobs/4180970763655839744, 200 exemplos reais (120 Amplitude Auto +
80 Amplitude Saude Empresarial), gerados pelo mesmo pipeline formal do
Modulo 2.2 (MinHash+LSH, amostragem por temperatura, entropia de Shannon),
so que escalado pro volume que um job de treino de verdade pede. Consultar
o status de um job ja concluido nao gera custo de treino novo.

Uso: python3 dataset_upload_and_tracking_tool.py
"""

import json
import subprocess
import urllib.request
from datetime import datetime, timezone

PROJETO = "amplitude-seguros-demo"
REGIAO = "us-central1"
NOME_JOB = "projects/113512199474/locations/us-central1/tuningJobs/4180970763655839744"

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


def validar_exemplo(exemplo):
    if not exemplo.get("instrucao") or not isinstance(exemplo["instrucao"], str):
        raise ValueError("exemplo sem instrucao valida")
    if not exemplo.get("entrada") or not isinstance(exemplo["entrada"], str):
        raise ValueError("exemplo sem entrada valida")
    if not isinstance(exemplo.get("saida"), dict):
        raise ValueError("exemplo sem saida valida")


def converter_para_formato_gemini(exemplo):
    """Converte um exemplo do schema canonico (instrucao/entrada/saida/
    metadata) pro formato que a Vertex AI espera pra fine-tuning
    supervisionado: uma lista de turnos com role e parts."""
    validar_exemplo(exemplo)
    texto_usuario = f"{exemplo['instrucao']}\n\n{exemplo['entrada']}"
    texto_modelo = json.dumps(exemplo["saida"], ensure_ascii=False)
    return {
        "contents": [
            {"role": "user", "parts": [{"text": texto_usuario}]},
            {"role": "model", "parts": [{"text": texto_modelo}]},
        ]
    }


LIMIAR_CONFIANCA_OCR_PADRAO = 0.85


def filtrar_por_confianca_ocr(exemplos, limiar=LIMIAR_CONFIANCA_OCR_PADRAO):
    """Gate de confianca de OCR (promessa do Modulo 2.1: metadata.confiancaOcr
    decide se um exemplo precisa de revisao humana antes do treino). So se
    aplica a exemplo que passou por OCR de verdade (tem confiancaOcr no
    metadata) -- exemplo gerado por texto sintetico, sem OCR real, passa
    direto, sem gate."""
    sem_confianca = []
    aprovados_por_ocr = []
    sinalizados_para_revisao = []

    for exemplo in exemplos:
        confianca = exemplo.get("metadata", {}).get("confiancaOcr")
        if confianca is None:
            sem_confianca.append(exemplo)
        elif confianca >= limiar:
            aprovados_por_ocr.append(exemplo)
        else:
            sinalizados_para_revisao.append(exemplo)

    return {
        "aprovados": aprovados_por_ocr + sem_confianca,
        "aprovadosPorOcr": aprovados_por_ocr,
        "semConfianca": sem_confianca,
        "sinalizadosParaRevisao": sinalizados_para_revisao,
        "limiar": limiar,
    }


# ==============================================================================
# >>> DAQUI PRA BAIXO: ORQUESTRACAO GOOGLE CLOUD - chamada de rede real <<<
# Exige projeto com billing ativo (aiplatform.googleapis.com). Tudo ACIMA
# desta marca (conversao, gate de OCR) roda 100% local, sem tocar rede e
# sem custo nenhum.
# ==============================================================================


def obter_token_acesso():
    return subprocess.check_output(
        ["gcloud", "auth", "print-access-token"], text=True
    ).strip()


def consultar_status_job(nome_job):
    token = obter_token_acesso()
    url = f"https://{REGIAO}-aiplatform.googleapis.com/v1/{nome_job}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resposta:
        return json.loads(resposta.read())


def formatar_duracao(inicio_iso, fim_iso):
    inicio = datetime.fromisoformat(inicio_iso.replace("Z", "+00:00"))
    fim = datetime.fromisoformat(fim_iso.replace("Z", "+00:00"))
    total_segundos = (fim - inicio).total_seconds()
    minutos = int(total_segundos // 60)
    segundos = total_segundos - minutos * 60
    return f"{minutos}min{segundos:.2f}s"


def rodar_testes():
    print("== Testes: conversão pro formato Gemini ==")

    exemplo_auto = {
        "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.",
        "entrada": "ATIVA ORCAMENTOS AUTOMOTIVOS OFICINA ESTRELA LTDA Segurado: Camila Costa Ribeiro Placa do veiculo: AZS-6617 Valor total do reparo: R$ 1.780,50",
        "saida": {"segurado": "Camila Costa Ribeiro", "placa": "AZS-6617", "valor": 1780.5},
        "metadata": {"caso": "amplitude-auto", "fonte": "Oficina Estrela", "id": "amplitude-auto-Oficina Estrela-5"},
    }

    def teste_dois_turnos():
        convertido = converter_para_formato_gemini(exemplo_auto)
        assert len(convertido["contents"]) == 2
        assert convertido["contents"][0]["role"] == "user"
        assert convertido["contents"][1]["role"] == "model"

    testar("conversão gera exatamente dois turnos, user e model", teste_dois_turnos)

    def teste_turno_usuario():
        convertido = converter_para_formato_gemini(exemplo_auto)
        texto = convertido["contents"][0]["parts"][0]["text"]
        assert exemplo_auto["instrucao"] in texto
        assert exemplo_auto["entrada"] in texto

    testar("turno do usuário concatena instrução e entrada", teste_turno_usuario)

    def teste_turno_modelo():
        convertido = converter_para_formato_gemini(exemplo_auto)
        saida_decodificada = json.loads(convertido["contents"][1]["parts"][0]["text"])
        assert saida_decodificada == exemplo_auto["saida"]

    testar("turno do modelo é o JSON exato da saída esperada", teste_turno_modelo)

    def teste_sem_instrucao():
        try:
            converter_para_formato_gemini({"entrada": "x", "saida": {}})
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "instrucao" in str(e)

    testar("rejeita exemplo sem instrucao", teste_sem_instrucao)

    def teste_sem_entrada():
        try:
            converter_para_formato_gemini({"instrucao": "x", "saida": {}})
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "entrada" in str(e)

    testar("rejeita exemplo sem entrada", teste_sem_entrada)

    def teste_sem_saida():
        try:
            converter_para_formato_gemini({"instrucao": "x", "entrada": "y"})
            raise AssertionError("deveria ter levantado erro")
        except ValueError as e:
            assert "saida" in str(e)

    testar("rejeita exemplo sem saida", teste_sem_saida)

    print()
    print("== Testes: gate de confiança de OCR ==")

    exemplos_reais_m21 = [
        {"metadata": {"id": "doc-auto-1", "confiancaOcr": 0.943}},
        {"metadata": {"id": "doc-auto-2", "confiancaOcr": 0.958}},
        {"metadata": {"id": "doc-saude-1", "confiancaOcr": 0.957}},
        {"metadata": {"id": "doc-saude-2", "confiancaOcr": 0.959}},
    ]

    def teste_documentos_reais_passam():
        resultado = filtrar_por_confianca_ocr(exemplos_reais_m21)
        assert len(resultado["aprovadosPorOcr"]) == 4
        assert len(resultado["sinalizadosParaRevisao"]) == 0

    testar(
        "os 4 documentos reais do Módulo 2.1 (94%-96% de confiança) passam todos no limiar padrão",
        teste_documentos_reais_passam,
    )

    def teste_confianca_baixa_sinalizada():
        scan_degradado = {"metadata": {"id": "doc-degradado", "confiancaOcr": 0.62}}
        resultado = filtrar_por_confianca_ocr(exemplos_reais_m21 + [scan_degradado])
        assert len(resultado["sinalizadosParaRevisao"]) == 1
        assert resultado["sinalizadosParaRevisao"][0]["metadata"]["id"] == "doc-degradado"
        assert not any(e["metadata"]["id"] == "doc-degradado" for e in resultado["aprovados"])

    testar(
        "exemplo com confiança abaixo do limiar é sinalizado pra revisão, não aprovado",
        teste_confianca_baixa_sinalizada,
    )

    def teste_sem_confianca_passa_sem_gate():
        sintetico = {"metadata": {"id": "amplitude-auto-Oficina Estrela-5"}}
        resultado = filtrar_por_confianca_ocr([sintetico])
        assert len(resultado["semConfianca"]) == 1
        assert len(resultado["aprovadosPorOcr"]) == 0
        assert sintetico in resultado["aprovados"]

    testar(
        "exemplo sem confiancaOcr (texto sintético, nunca passou por OCR) segue aprovado sem gate",
        teste_sem_confianca_passa_sem_gate,
    )

    def teste_limiar_exato_aprova():
        exemplo = {"metadata": {"id": "limiar-exato", "confiancaOcr": LIMIAR_CONFIANCA_OCR_PADRAO}}
        resultado = filtrar_por_confianca_ocr([exemplo])
        assert len(resultado["aprovadosPorOcr"]) == 1

    testar("confiança exatamente igual ao limiar é aprovada (>=, não >)", teste_limiar_exato_aprova)

    def teste_limiar_customizado():
        exemplo = {"metadata": {"id": "confianca-70", "confiancaOcr": 0.7}}
        resultado_padrao = filtrar_por_confianca_ocr([exemplo])
        resultado_frouxo = filtrar_por_confianca_ocr([exemplo], 0.6)
        assert len(resultado_padrao["sinalizadosParaRevisao"]) == 1
        assert len(resultado_frouxo["aprovadosPorOcr"]) == 1

    testar("limiar customizado é respeitado em vez do padrão", teste_limiar_customizado)

    print()
    print("== Testes: formatação de duração ==")

    def teste_duracao_real():
        formatado = formatar_duracao(
            "2026-08-08T02:38:12.364747Z", "2026-08-08T03:23:54.310390Z"
        )
        assert formatado == "45min41.95s"

    testar("duração de 45min41,95s é formatada corretamente", teste_duracao_real)

    def teste_duracao_um_minuto():
        formatado = formatar_duracao(
            "2026-01-01T00:00:00.000Z", "2026-01-01T00:01:00.000Z"
        )
        assert formatado == "1min0.00s"

    testar("duração de exatamente 1 minuto é formatada corretamente", teste_duracao_um_minuto)

    print()
    print(f"Total: {total_testes} teste(s), {total_testes - testes_com_falha} passou(passaram), {testes_com_falha} falhou(falharam).")


def main():
    rodar_testes()

    print()
    print("== Conversão de exemplos reais do dataset (Amplitude Auto + Saúde Empresarial) ==")

    exemplo_auto = {
        "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.",
        "entrada": "ATIVA ORCAMENTOS AUTOMOTIVOS OFICINA ESTRELA LTDA CNPJ 12.345.678/0001-90 Rua das Turbinas 450 Distrito Industrial Segurado: Camila Costa Ribeiro Placa do veiculo: AZS-6617 Data do sinistro: 21/05/2026 Descricao do servico: reparo de lataria e pintura no para-choque dianteiro Valor total do reparo: R$ 1.780,50",
        "saida": {"segurado": "Camila Costa Ribeiro", "placa": "AZS-6617", "valor": 1780.5},
        "metadata": {"caso": "amplitude-auto", "fonte": "Oficina Estrela", "id": "amplitude-auto-Oficina Estrela-5"},
    }

    exemplo_saude = {
        "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.",
        "entrada": "CLINICA VITALIS SAUDE OCUPACIONAL CNPJ 33.222.111/0001-44 Av. Paulista 900 Paciente/Beneficiario: Thiago Augusto Barbosa Procedimento: consulta ginecologica Data do atendimento: 02/05/2026 Valor cobrado: R$ 4.430,00",
        "saida": {"beneficiario": "Thiago Augusto Barbosa", "procedimento": "consulta ginecologica", "valor": 4430},
        "metadata": {"caso": "amplitude-saude-empresarial", "fonte": "Clínica Vitalis", "id": "amplitude-saude-empresarial-Clínica Vitalis-8"},
    }

    for exemplo in (exemplo_auto, exemplo_saude):
        convertido = converter_para_formato_gemini(exemplo)
        print(f"\n{exemplo['metadata']['id']}:")
        print(json.dumps(convertido, indent=2, ensure_ascii=False))

    print()
    print("== Gate de confiança de OCR (promessa do Módulo 2.1, cumprida aqui) ==")

    documentos_reais_m21 = [
        {"metadata": {"id": "doc-auto-1.png", "confiancaOcr": 0.943}},
        {"metadata": {"id": "doc-auto-2.png", "confiancaOcr": 0.958}},
        {"metadata": {"id": "doc-saude-1.png", "confiancaOcr": 0.957}},
        {"metadata": {"id": "doc-saude-2.png", "confiancaOcr": 0.959}},
    ]
    scan_degradado_hipotetico = {"metadata": {"id": "doc-danificado-por-agua.png", "confiancaOcr": 0.62}}
    exemplo_do_dataset_de_hoje = {
        "metadata": {"caso": "amplitude-auto", "fonte": "Oficina Estrela", "id": "amplitude-auto-Oficina Estrela-5"}
    }

    resultado_gate = filtrar_por_confianca_ocr(
        documentos_reais_m21 + [scan_degradado_hipotetico, exemplo_do_dataset_de_hoje]
    )

    print(f"Limiar: {resultado_gate['limiar']} ({resultado_gate['limiar'] * 100:.0f}% de confiança)")
    print(f"Aprovados por OCR real: {len(resultado_gate['aprovadosPorOcr'])} (os 4 documentos reais do Módulo 2.1, 94%-96%)")
    sinalizados_ids = ", ".join(
        f"{e['metadata']['id']} confiança {e['metadata']['confiancaOcr'] * 100:.0f}%"
        for e in resultado_gate["sinalizadosParaRevisao"]
    )
    print(f"Sinalizados para revisão humana: {len(resultado_gate['sinalizadosParaRevisao'])} ({sinalizados_ids}, abaixo do limiar)")
    sem_confianca_ids = ", ".join(e["metadata"]["id"] for e in resultado_gate["semConfianca"])
    print(f"Sem OCR, seguem sem gate: {len(resultado_gate['semConfianca'])} ({sem_confianca_ids}, texto sintético, nunca foi escaneado)")
    print("Nenhum dos 200 exemplos do job de hoje passou por este gate, porque nenhum deles veio de OCR de verdade.")

    print()
    print("== Acompanhamento real do job de fine-tuning ==")
    print(f"Job: {NOME_JOB}")

    try:
        job = consultar_status_job(NOME_JOB)
        print(f"Estado: {job.get('state')}")
        print(f"Modelo base: {job.get('baseModel')}")
        print(f"Nome de exibição: {job.get('tunedModelDisplayName')}")
        print(f"Início: {job.get('startTime')}")
        print(f"Fim: {job.get('endTime')}")
        if job.get("startTime") and job.get("endTime"):
            print(f"Duração real: {formatar_duracao(job['startTime'], job['endTime'])}")
        tuned_model = job.get("tunedModel")
        if tuned_model:
            print(f"Modelo ajustado: {tuned_model.get('model')}")
            print(f"Endpoint publicado: {tuned_model.get('endpoint')}")
    except Exception as erro:
        print(f"Não foi possível consultar o job agora: {erro}")


if __name__ == "__main__":
    main()

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
