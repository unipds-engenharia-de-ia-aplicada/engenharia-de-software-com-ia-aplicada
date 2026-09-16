"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 6.3

Reavaliacao real do modelo escalado (3.000 exemplos, tuningJobs/8278721957516541952)
contra os mesmos 3 conjuntos ja usados no Modulo 5 (teste retido do M5.1, Round 1 e
Round 2 do M5.3), pra comparar com o piloto de 200 exemplos de forma justa e
reproduzivel. Reusa gerar_conjunto_teste_retido/avaliar_adequacao_schema/
avaliar_precisao_por_campo do harness do Modulo 5.1 direto (sem duplicar logica de
avaliacao) -- so a constante de endpoint muda, porque o harness do M5.1 e sobre o
modelo de 200, nao sobre este.

Os 2 conjuntos de invariancia (Round 1/Round 2) do Modulo 5.3 nao sao exportados no
arquivo original, entao os mesmos 12 exemplos escritos a mao sao reproduzidos aqui
literalmente, pra nao depender de reescrever o arquivo do M5.3.

Uso: python3 m6_scaled_model_verification_tool.py
Requer: ENDPOINT_MODULO32 (endpoint do SEU modelo de 200 exemplos, Modulo
3.2) e ENDPOINT_MODULO63 (endpoint do SEU modelo escalado, 3.000 exemplos)
definidas -- veja README.md, secao "Antes de rodar".
"""

import importlib.util
import os
import sys
import json
import subprocess
import urllib.request
from pathlib import Path

_M5_1_PATH = Path(__file__).parent.parent / "modulo-05-avaliacao-modelos" / "model_evaluation_harness_tool.py"
_spec = importlib.util.spec_from_file_location("model_evaluation_harness_tool", _M5_1_PATH)
m51 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m51)

REGIAO = "us-central1"
# CONFIGURACAO: cada aluno usa os proprios endpoints -- nenhum valor padrao
# aponta pro autor do curso. ENDPOINT_ANTIGO e o mesmo endpoint do Modulo
# 3.2 (200 exemplos), ENDPOINT_NOVO e o do seu modelo escalado (3.000
# exemplos), se voce tiver treinado um.
ENDPOINT_ANTIGO = os.environ.get("ENDPOINT_MODULO32")  # 200 exemplos (Modulo 3.2)
if not ENDPOINT_ANTIGO:
    raise RuntimeError(
        "Defina a variavel de ambiente ENDPOINT_MODULO32 com o endpoint do "
        "seu modelo publicado no Modulo 3.2 antes de rodar este script."
    )
ENDPOINT_NOVO = os.environ.get("ENDPOINT_MODULO63")  # 3.000 exemplos (modelo escalado, Modulo 6.3)
if not ENDPOINT_NOVO:
    raise RuntimeError(
        "Defina a variavel de ambiente ENDPOINT_MODULO63 com o endpoint do "
        "seu modelo escalado antes de rodar este script."
    )


def obter_token_acesso():
    return subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def chamar_modelo(endpoint, exemplo):
    token = obter_token_acesso()
    url = f"https://{REGIAO}-aiplatform.googleapis.com/v1/{endpoint}:generateContent"
    texto_usuario = f"{exemplo['instrucao']}\n\n{exemplo['entrada']}"
    corpo = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": texto_usuario}]}],
        "generationConfig": {"temperature": 0},
    }).encode("utf-8")
    req = urllib.request.Request(url, data=corpo, method="POST", headers={
        "Authorization": f"Bearer {token}", "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req) as resposta:
        dados = json.loads(resposta.read())
    return dados["candidates"][0]["content"]["parts"][0]["text"]


def gerar_conjunto_invariancia():
    return [
        {"metadata": {"id": "invariancia-auto-001", "caso": "amplitude-auto"}, "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.", "entrada": "Oficina Mecânica Torque Real, CNPJ 44.333.222/0001-11. Cliente segurado: Fernanda Lima. Chapa do carro: XYZ-9988. Serviço de suspensão dianteira. Total a pagar: 1.200,50", "saida": {"segurado": "Fernanda Lima", "placa": "XYZ-9988", "valor": 1200.5}},
        {"metadata": {"id": "invariancia-auto-002", "caso": "amplitude-auto"}, "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.", "entrada": "Auto Center Bandeirantes. Atendente responsável: Carlos Souza. Segurado: Juliana Ferreira Neves. Placa do veículo: MER-4521. Troca de para-choque traseiro. Valor total do reparo: R$ 890,00", "saida": {"segurado": "Juliana Ferreira Neves", "placa": "MER-4521", "valor": 890.0}},
        {"metadata": {"id": "invariancia-auto-003", "caso": "amplitude-auto"}, "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.", "entrada": "O veículo de Ricardo Alves Monteiro, placa BRA-2119, deu entrada na Oficina Estrela Sul para reparo de amassado na porta dianteira. O orçamento fechado ficou em R$ 2.340,90.", "saida": {"segurado": "Ricardo Alves Monteiro", "placa": "BRA-2119", "valor": 2340.9}},
        {"metadata": {"id": "invariancia-saude-001", "caso": "amplitude-saude-empresarial"}, "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.", "entrada": "Clínica São Rafael. Paciente atendido: Marcos Lopes Guimarães. Procedimento: exame de sangue completo. Valor a cobrar: 340,00", "saida": {"beneficiario": "Marcos Lopes Guimarães", "procedimento": "exame de sangue completo", "valor": 340.0}},
        {"metadata": {"id": "invariancia-saude-002", "caso": "amplitude-saude-empresarial"}, "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.", "entrada": "Dr. Fernando Costa (CRM 55231) atendeu o paciente/beneficiário Juliana Ferreira Neves para consulta de cardiologia. Valor cobrado: R$ 890,00.", "saida": {"beneficiario": "Juliana Ferreira Neves", "procedimento": "consulta de cardiologia", "valor": 890.0}},
        {"metadata": {"id": "invariancia-saude-003", "caso": "amplitude-saude-empresarial"}, "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.", "entrada": "A consulta de dermatologia realizada para Paulo Moreira Duarte, na Clínica Vitalis, custou R$ 1.150,00, conforme recibo emitido nesta data.", "saida": {"beneficiario": "Paulo Moreira Duarte", "procedimento": "consulta de dermatologia", "valor": 1150.0}},
    ]


def gerar_conjunto_invariancia_severo():
    return [
        {"metadata": {"id": "invariancia-severo-auto-001", "caso": "amplitude-auto"}, "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.", "entrada": "Oi, aqui é da oficina! O carro da Camila Duarte Nogueira já tá pronto, placa QWE-3344. Ficou 3200 reais o conserto do motor, pode vir buscar.", "saida": {"segurado": "Camila Duarte Nogueira", "placa": "QWE-3344", "valor": 3200.0}},
        {"metadata": {"id": "invariancia-severo-auto-002", "caso": "amplitude-auto"}, "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.", "entrada": "Segurado: Bruno Tavares Costa. Placa: LMN-7712. O reparo total do para-lama ficou em três mil e quinhentos reais.", "saida": {"segurado": "Bruno Tavares Costa", "placa": "LMN-7712", "valor": 3500.0}},
        {"metadata": {"id": "invariancia-severo-auto-003", "caso": "amplitude-auto"}, "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.", "entrada": "Relatório da oficina: dois veículos em reparo hoje. O primeiro, placa AAA-1111, é de Marcelo Dias, ainda aguardando peça, orçamento não fechado. O segundo, do segurado Patricia Almeida Rocha, placa BBB-2222, teve o orçamento aprovado em R$ 1.780,00.", "saida": {"segurado": "Patricia Almeida Rocha", "placa": "BBB-2222", "valor": 1780.0}},
        {"metadata": {"id": "invariancia-severo-saude-001", "caso": "amplitude-saude-empresarial"}, "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.", "entrada": "Boa tarde! Segue o valor do exame da Camila Duarte Nogueira: raio-x do tórax, ficou 450 reais.", "saida": {"beneficiario": "Camila Duarte Nogueira", "procedimento": "raio-x do tórax", "valor": 450.0}},
        {"metadata": {"id": "invariancia-severo-saude-002", "caso": "amplitude-saude-empresarial"}, "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.", "entrada": "Beneficiário: Bruno Tavares Costa. Procedimento: consulta de oftalmologia. O valor cobrado foi mil e cem reais.", "saida": {"beneficiario": "Bruno Tavares Costa", "procedimento": "consulta de oftalmologia", "valor": 1100.0}},
        {"metadata": {"id": "invariancia-severo-saude-003", "caso": "amplitude-saude-empresarial"}, "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.", "entrada": "Relatório da clínica: dois atendimentos hoje. O primeiro, para o beneficiário Marcelo Dias, consulta de rotina, ainda sem cobrança definida, avaliação em andamento. O segundo, da beneficiária Patricia Almeida Rocha, exame de ressonância magnética, valor R$ 2.900,00.", "saida": {"beneficiario": "Patricia Almeida Rocha", "procedimento": "exame de ressonância magnética", "valor": 2900.0}},
    ]


def avaliar_conjunto(endpoint, exemplos):
    resultados = []
    for exemplo in exemplos:
        texto_resposta = chamar_modelo(endpoint, exemplo)
        schema = m51.avaliar_adequacao_schema(exemplo["metadata"]["caso"], texto_resposta)
        if schema["valido"]:
            precisao = m51.avaliar_precisao_por_campo(exemplo["saida"], schema["campos"])["precisao"]
        else:
            precisao = 0
        resultados.append({"id": exemplo["metadata"]["id"], "schemaValido": schema["valido"], "precisao": precisao})
    schemas_validos = sum(1 for r in resultados if r["schemaValido"])
    precisao_media = sum(r["precisao"] for r in resultados) / len(resultados)
    return {"resultados": resultados, "schemasValidos": schemas_validos, "total": len(resultados), "precisaoMedia": precisao_media}


# ---------------------------------------------------------------------------
# Testes automatizados (offline, nao tocam rede)
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
    print("== Testes: conjuntos de verificação ==")

    def t1():
        c = gerar_conjunto_invariancia()
        assert len(c) == 6
        assert sum(1 for e in c if e["metadata"]["caso"] == "amplitude-auto") == 3

    testar("conjunto de invariância (Round 1) tem 6 exemplos, 3 Auto + 3 Saúde", t1)

    def t2():
        c = gerar_conjunto_invariancia_severo()
        assert len(c) == 6
        assert sum(1 for e in c if e["metadata"]["caso"] == "amplitude-auto") == 3

    testar("conjunto de invariância severa (Round 2) tem 6 exemplos, 3 Auto + 3 Saúde", t2)

    def t3():
        assert ENDPOINT_ANTIGO != ENDPOINT_NOVO

    testar("endpoint novo e antigo são distintos (comparação não compara o modelo com ele mesmo)", t3)

    print()
    print(f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), {_testes_com_falha} falhou(falharam).")


# ---------------------------------------------------------------------------
# Execução principal: roda os 3 conjuntos contra os dois endpoints
# ---------------------------------------------------------------------------


def main():
    rodar_testes()

    print()
    print("== Reavaliação real: modelo de 200 exemplos vs. modelo de 3.000 exemplos ==")
    print("(mesmo harness, mesmos 3 conjuntos do Módulo 5, endpoints diferentes)\n")

    for rotulo, endpoint in [("ANTIGO (200 exemplos)", ENDPOINT_ANTIGO), ("NOVO (3.000 exemplos)", ENDPOINT_NOVO)]:
        print(f"--- Modelo {rotulo} ---")
        retido = avaliar_conjunto(endpoint, m51.gerar_conjunto_teste_retido())
        round1 = avaliar_conjunto(endpoint, gerar_conjunto_invariancia())
        round2 = avaliar_conjunto(endpoint, gerar_conjunto_invariancia_severo())
        print(f"Teste retido: {retido['schemasValidos']}/{retido['total']} schema, {retido['precisaoMedia']*100:.1f}% precisão")
        print(f"Round 1:      {round1['schemasValidos']}/{round1['total']} schema, {round1['precisaoMedia']*100:.1f}% precisão")
        print(f"Round 2:      {round2['schemasValidos']}/{round2['total']} schema, {round2['precisaoMedia']*100:.1f}% precisão")
        print()


if __name__ == "__main__":
    try:
        main()
    except Exception as erro:
        print(f"\nErro: {erro}")
        print("Verifique a autenticacao (gcloud auth login) e a conexao de rede, e tente de novo.")
        if os.environ.get("DEBUG"):
            raise
        sys.exit(1)

# Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
