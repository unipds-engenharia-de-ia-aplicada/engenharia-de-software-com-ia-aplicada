"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 5.3

Pergunta real: o teste retido do Modulo 5.1 prova generalizacao de verdade, ou
so prova que o modelo decorou o FORMATO do gerador deterministico
(m3_dataset_scaling_tool.gerar_exemplo) que criou os 200 exemplos de treino?
Todo exemplo do teste retido -- e todo exemplo de treino -- vem do mesmo
gerador, com o mesmo vocabulario fixo ("Segurado:", "Placa do veiculo:",
sempre "R$ X.XXX,XX"). Trocar o indice nao muda o template.

Este modulo constroi exemplos NOVOS, escritos a mao (nao gerados pelo
gerador deterministico), em tres blocos: uma sonda de capacidade geral
(Round 0) e dois niveis de dificuldade de estresse de formato, 6 exemplos
cada, 12 no total:

Round 0 (capacidade geral): 4 perguntas fora do dominio Amplitude Seguros,
sem gabarito de campo -- mede se o modelo ainda sabe fazer outra coisa,
nao se ele erra a extracao num formato dificil.

Round 1 (variacao de formato): rotulo em linguagem coloquial, valor sem
simbolo "R$", texto corrido em vez de campo:valor, nomes-isca (uma segunda
pessoa mencionada). Documentos plausiveis, resolviveis por um humano --
nao lixo deliberadamente malformado.

Round 2 (variacao estrutural): mensagem informal sem estrutura de
documento, valor por extenso sem nenhum digito, e duas entidades no mesmo
texto exigindo ler qual delas tem valor fechado -- nada disso existe nos
200 exemplos de treino, onde cada documento sempre tem exatamente uma
entidade.

Reusa avaliar_adequacao_schema e avaliar_precisao_por_campo do Modulo 5.1 --
mesmas metricas, sem duplicar logica.

Uso: python3 overfitting_stress_test_tool.py [round0|round1|round2|round2-medir] [N]
"""

import importlib.util
import json
import os
import sys
import time
from datetime import date
from pathlib import Path

_M5_1_PATH = Path(__file__).parent / "model_evaluation_harness_tool.py"
_spec = importlib.util.spec_from_file_location("model_evaluation_harness_tool", _M5_1_PATH)
m51 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m51)

_M5_2_PATH = Path(__file__).parent / "ab_and_domain_tradeoff_tool.py"
_spec52 = importlib.util.spec_from_file_location("ab_and_domain_tradeoff_tool", _M5_2_PATH)
m52 = importlib.util.module_from_spec(_spec52)
_spec52.loader.exec_module(m52)


# ---------------------------------------------------------------------------
# 0. Sonda de capacidade geral -- pergunta diferente de round 1/round 2. Nao
# e "o modelo erra a extracao num formato dificil?" (isso e round 1 e round
# 2), e "o modelo ainda sabe fazer outra coisa, fora de extracao?". 4
# perguntas fora do dominio Amplitude Seguros, sem gabarito de campo -- a
# metrica aqui e qualitativa: o texto de resposta ainda e coerente e
# seguro, comparado ao modelo generico no mesmo prompt.
# ---------------------------------------------------------------------------


def gerar_sonda_capacidade_geral():
    return [
        {"id": "geral-001", "dominio": "conhecimento factual", "pergunta": "Qual é a capital da França?"},
        {"id": "geral-002", "dominio": "raciocínio matemático", "pergunta": "Se um trem viaja a 80 km/h por 3 horas, qual distância ele percorre?"},
        {"id": "geral-003", "dominio": "conceito técnico", "pergunta": "Explique em uma frase o que é recursão em programação."},
        {"id": "geral-004", "dominio": "escrita livre", "pergunta": "Escreva uma frase curta e inspiradora sobre perseverança."},
    ]


# ---------------------------------------------------------------------------
# 1. Conjunto de teste de invariancia (escrito a mao, nunca gerado pelo template)
# ---------------------------------------------------------------------------


def gerar_conjunto_invariancia():
    return [
        {
            "metadata": {"id": "invariancia-auto-001", "caso": "amplitude-auto", "variacao": "sem símbolo R$, rótulo coloquial"},
            "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.",
            "entrada": "Oficina Mecânica Torque Real, CNPJ 44.333.222/0001-11. Cliente segurado: Fernanda Lima. Chapa do carro: XYZ-9988. Serviço de suspensão dianteira. Total a pagar: 1.200,50",
            "saida": {"segurado": "Fernanda Lima", "placa": "XYZ-9988", "valor": 1200.5},
        },
        {
            "metadata": {"id": "invariancia-auto-002", "caso": "amplitude-auto", "variacao": "nome-isca (atendente antes do segurado)"},
            "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.",
            "entrada": "Auto Center Bandeirantes. Atendente responsável: Carlos Souza. Segurado: Juliana Ferreira Neves. Placa do veículo: MER-4521. Troca de para-choque traseiro. Valor total do reparo: R$ 890,00",
            "saida": {"segurado": "Juliana Ferreira Neves", "placa": "MER-4521", "valor": 890.0},
        },
        {
            "metadata": {"id": "invariancia-auto-003", "caso": "amplitude-auto", "variacao": "texto corrido, sem campo:valor"},
            "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.",
            "entrada": "O veículo de Ricardo Alves Monteiro, placa BRA-2119, deu entrada na Oficina Estrela Sul para reparo de amassado na porta dianteira. O orçamento fechado ficou em R$ 2.340,90.",
            "saida": {"segurado": "Ricardo Alves Monteiro", "placa": "BRA-2119", "valor": 2340.9},
        },
        {
            "metadata": {"id": "invariancia-saude-001", "caso": "amplitude-saude-empresarial", "variacao": "sem símbolo R$, rótulo coloquial"},
            "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.",
            "entrada": "Clínica São Rafael. Paciente atendido: Marcos Lopes Guimarães. Procedimento: exame de sangue completo. Valor a cobrar: 340,00",
            "saida": {"beneficiario": "Marcos Lopes Guimarães", "procedimento": "exame de sangue completo", "valor": 340.0},
        },
        {
            "metadata": {"id": "invariancia-saude-002", "caso": "amplitude-saude-empresarial", "variacao": "nome-isca (médico antes do beneficiário)"},
            "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.",
            "entrada": "Dr. Fernando Costa (CRM 55231) atendeu o paciente/beneficiário Juliana Ferreira Neves para consulta de cardiologia. Valor cobrado: R$ 890,00.",
            "saida": {"beneficiario": "Juliana Ferreira Neves", "procedimento": "consulta de cardiologia", "valor": 890.0},
        },
        {
            "metadata": {"id": "invariancia-saude-003", "caso": "amplitude-saude-empresarial", "variacao": "texto corrido, sem campo:valor"},
            "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.",
            "entrada": "A consulta de dermatologia realizada para Ricardo Nunes Barbosa, na Clínica Vitalis, custou R$ 1.150,00, conforme recibo emitido nesta data.",
            "saida": {"beneficiario": "Ricardo Nunes Barbosa", "procedimento": "consulta de dermatologia", "valor": 1150.0},
        },
    ]


# ---------------------------------------------------------------------------
# 1.1 Conjunto de invariancia SEVERO -- variacao estrutural, nao so de rotulo.
# Round 1 testou sinonimo de rotulo e nome-isca; o modelo passou (6/6, 100%
# apos corrigir o bug de comparacao com maiuscula). Este round empurra mais:
# mensagem informal sem estrutura de documento, valor por extenso sem
# nenhum digito, e dois "beneficiarios"/"segurados" no mesmo texto exigindo
# ler qual dos dois tem valor fechado -- nada disso existe nos 200 exemplos
# de treino, onde cada documento sempre tem exatamente uma entidade.
# ---------------------------------------------------------------------------


def gerar_conjunto_invariancia_severo():
    return [
        {
            "metadata": {"id": "invariancia-severo-auto-001", "caso": "amplitude-auto", "variacao": "mensagem informal, sem estrutura de documento"},
            "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.",
            "entrada": "Oi, aqui é da oficina! O carro da Camila Duarte Nogueira já tá pronto, placa QWE-3344. Ficou 3200 reais o conserto do motor, pode vir buscar.",
            "saida": {"segurado": "Camila Duarte Nogueira", "placa": "QWE-3344", "valor": 3200.0},
        },
        {
            "metadata": {"id": "invariancia-severo-auto-002", "caso": "amplitude-auto", "variacao": "valor por extenso, sem nenhum dígito"},
            "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.",
            "entrada": "Segurado: Bruno Tavares Costa. Placa: LMN-7712. O reparo total do para-lama ficou em três mil e quinhentos reais.",
            "saida": {"segurado": "Bruno Tavares Costa", "placa": "LMN-7712", "valor": 3500.0},
        },
        {
            "metadata": {"id": "invariancia-severo-auto-003", "caso": "amplitude-auto", "variacao": "dois veículos no mesmo texto, só um com orçamento fechado"},
            "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.",
            "entrada": "Relatório da oficina: dois veículos em reparo hoje. O primeiro, placa AAA-1111, é de Marcelo Dias, ainda aguardando peça, orçamento não fechado. O segundo, do segurado Patricia Almeida Rocha, placa BBB-2222, teve o orçamento aprovado em R$ 1.780,00.",
            "saida": {"segurado": "Patricia Almeida Rocha", "placa": "BBB-2222", "valor": 1780.0},
        },
        {
            "metadata": {"id": "invariancia-severo-saude-001", "caso": "amplitude-saude-empresarial", "variacao": "mensagem informal, sem estrutura de documento"},
            "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.",
            "entrada": "Boa tarde! Segue o valor do exame da Camila Duarte Nogueira: raio-x do tórax, ficou 450 reais.",
            "saida": {"beneficiario": "Camila Duarte Nogueira", "procedimento": "raio-x do tórax", "valor": 450.0},
        },
        {
            "metadata": {"id": "invariancia-severo-saude-002", "caso": "amplitude-saude-empresarial", "variacao": "valor por extenso, sem nenhum dígito"},
            "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.",
            "entrada": "Beneficiário: Bruno Tavares Costa. Procedimento: consulta de oftalmologia. O valor cobrado foi mil e cem reais.",
            "saida": {"beneficiario": "Bruno Tavares Costa", "procedimento": "consulta de oftalmologia", "valor": 1100.0},
        },
        {
            "metadata": {"id": "invariancia-severo-saude-003", "caso": "amplitude-saude-empresarial", "variacao": "dois pacientes no mesmo texto, só um com valor definido"},
            "instrucao": "Extraia beneficiário, procedimento e valor do recibo médico abaixo.",
            "entrada": "Relatório da clínica: dois atendimentos hoje. O primeiro, para o beneficiário Marcelo Dias, consulta de rotina, ainda sem cobrança definida, avaliação em andamento. O segundo, da beneficiária Patricia Almeida Rocha, exame de ressonância magnética, valor R$ 2.900,00.",
            "saida": {"beneficiario": "Patricia Almeida Rocha", "procedimento": "exame de ressonância magnética", "valor": 2900.0},
        },
    ]


# ---------------------------------------------------------------------------
# 2. Avaliacao contra o endpoint real do Modulo 3.2
# ---------------------------------------------------------------------------


def avaliar_conjunto(exemplos):
    resultados = []
    falhas = []
    for exemplo in exemplos:
        try:
            texto_resposta = m51.chamar_modelo_real(exemplo)
        except Exception as erro:
            print(f"  [FALHOU] {exemplo['metadata']['id']}: {erro}")
            falhas.append({"id": exemplo["metadata"]["id"], "erro": str(erro)})
            continue
        schema = m51.avaliar_adequacao_schema(exemplo["metadata"]["caso"], texto_resposta)
        if schema["valido"]:
            precisao = m51.avaliar_precisao_por_campo(exemplo["saida"], schema["campos"])
        else:
            precisao = {"precisao": 0, "acertos": 0, "total": len(exemplo["saida"])}
        resultados.append({
            "id": exemplo["metadata"]["id"],
            "variacao": exemplo["metadata"].get("variacao", ""),
            "textoResposta": texto_resposta,
            "schemaValido": schema["valido"],
            "precisao": precisao["precisao"],
        })
    if falhas:
        print(f"  {len(falhas)}/{len(exemplos)} exemplo(s) falharam na chamada real.")
    if not resultados:
        raise RuntimeError("Nenhum exemplo processado com sucesso -- verifique projeto/endpoint/billing.")
    schemas_validos = sum(1 for r in resultados if r["schemaValido"])
    precisao_media = sum(r["precisao"] for r in resultados) / len(resultados)
    return {
        "resultados": resultados,
        "schemasValidos": schemas_validos,
        "total": len(resultados),
        "precisaoMedia": precisao_media,
        "falhas": falhas,
    }


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


def testar_com_rede(descricao, fn):
    # Par de testarAsync() do .js: este teste chama a rede de verdade
    # (chamar_modelo_real contra um endpoint real), entao captura qualquer
    # falha de rede/autenticacao, nao so AssertionError, pra reportar
    # [FALHOU] em vez de derrubar o resto da suite.
    global _total_testes, _testes_com_falha
    _total_testes += 1
    try:
        fn()
        print(f"  [OK] {descricao}")
    except Exception as erro:
        _testes_com_falha += 1
        print(f"  [FALHOU] {descricao}")
        print(f"           {erro}")


def rodar_testes():
    print("== Testes: conjunto de invariância ==")

    def t1():
        conjunto = gerar_conjunto_invariancia()
        assert len(conjunto) == 6
        assert sum(1 for e in conjunto if e["metadata"]["caso"] == "amplitude-auto") == 3
        assert sum(1 for e in conjunto if e["metadata"]["caso"] == "amplitude-saude-empresarial") == 3
        for e in conjunto:
            assert "variacao" in e["metadata"], f"{e['metadata']['id']} sem variacao documentada"

    testar("gera 6 exemplos (3 Auto + 3 Saúde), cada um com variação documentada", t1)

    def t2():
        conjunto = gerar_conjunto_invariancia()
        ids_retidos = {e["metadata"]["id"] for e in m51.gerar_conjunto_teste_retido()}
        ids_adversariais = {e["metadata"]["id"] for e in conjunto}
        assert ids_retidos.isdisjoint(ids_adversariais), "IDs adversariais colidem com o teste retido do M5.1"

    testar("nenhum ID do conjunto de invariância colide com o teste retido do M5.1", t2)

    def t3():
        exemplo = gerar_conjunto_invariancia()[0]
        texto_resposta = m51.chamar_modelo_real(exemplo)
        assert isinstance(texto_resposta, str) and len(texto_resposta) > 0

    testar_com_rede("chamada real ao endpoint do Módulo 3.2 devolve uma resposta não vazia", t3)

    def t4():
        conjunto = gerar_conjunto_invariancia_severo()
        assert len(conjunto) == 6
        assert sum(1 for e in conjunto if e["metadata"]["caso"] == "amplitude-auto") == 3
        assert sum(1 for e in conjunto if e["metadata"]["caso"] == "amplitude-saude-empresarial") == 3
        ids_retidos = {e["metadata"]["id"] for e in m51.gerar_conjunto_teste_retido()}
        ids_invariancia_base = {e["metadata"]["id"] for e in gerar_conjunto_invariancia()}
        ids_severo = {e["metadata"]["id"] for e in conjunto}
        assert ids_severo.isdisjoint(ids_retidos | ids_invariancia_base), "IDs do conjunto severo colidem com outro conjunto"

    testar("gera 6 exemplos severos (3 Auto + 3 Saúde), sem colisão de ID com os outros dois conjuntos", t4)

    print()
    print(f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), {_testes_com_falha} falhou(falharam).")


def rodar_testes_round0():
    print("== Testes: sonda de capacidade geral (Round 0) ==")

    def t5():
        sonda = gerar_sonda_capacidade_geral()
        assert len(sonda) == 4
        import re
        for s in sonda:
            assert s["dominio"], f"{s['id']} sem dominio documentado"
            assert not re.search(r"segurado|beneficiário|placa|procedimento|orçamento|Amplitude", s["pergunta"], re.IGNORECASE), f"{s['id']} vaza vocabulario do dominio de treino"

    testar("sonda de capacidade geral tem 4 perguntas, cada uma com domínio documentado e fora do vocabulário Amplitude Seguros", t5)

    def t6():
        # Capturado rodando de verdade os dois lados na mesma pergunta ("Qual e
        # a capital da Franca?"). Nao e falha de conteudo -- os dois acertam
        # Paris -- e vies de FORMATO generalizando alem da tarefa de treino.
        resposta_fine_tunado = '{"answer":"Paris"}'
        resposta_generico = "A capital da França é **Paris**."
        import re
        assert re.match(r"^\s*\{.*\}\s*$", resposta_fine_tunado, re.DOTALL), "esperava JSON do fine-tunado"
        assert not re.match(r"^\s*\{", resposta_generico), "esperava prosa livre do generico, nao JSON"
        assert "Paris" in resposta_fine_tunado and "Paris" in resposta_generico, "os dois precisam acertar o conteudo, so o formato diverge"

    testar("achado real: fine-tunado generaliza o hábito de responder em JSON pra pergunta fora do domínio; genérico responde em prosa livre", t6)

    print()
    print(f"Total: {_total_testes} teste(s), {_total_testes - _testes_com_falha} passou(passaram), {_testes_com_falha} falhou(falharam).")


# ---------------------------------------------------------------------------
# Execução principal
# ---------------------------------------------------------------------------


def rodar_round0():
    print("== Round 0: o modelo ainda sabe fazer outra coisa, fora de extração? ==")
    print("4 perguntas fora do domínio Amplitude Seguros, fine-tunado vs. genérico, mesmo prompt.\n")

    sonda = gerar_sonda_capacidade_geral()
    falhas = 0
    for item in sonda:
        exemplo = {"instrucao": item["pergunta"], "entrada": ""}
        try:
            resposta_fine_tunado = m51.chamar_modelo_real(exemplo)
            resposta_generico = m52.chamar_recurso(m52.MODELO_GENERICO, exemplo)
        except Exception as erro:
            print(f"[{item['dominio']}] {item['pergunta']}")
            print(f"  [FALHOU] {erro}\n")
            falhas += 1
            continue
        print(f"[{item['dominio']}] {item['pergunta']}")
        print(f"  Fine-tunado: {resposta_fine_tunado.strip().replace(chr(10), ' ')}")
        print(f"  Genérico:    {resposta_generico.strip().replace(chr(10), ' ')}")
        print()
    if falhas:
        print(f"{falhas}/{len(sonda)} pergunta(s) falharam na chamada real -- verifique projeto/endpoint/billing.\n")


# ---------------------------------------------------------------------------
# Ledger de resultado medido -- consumido pelo veredito_escala_tool.py do
# Modulo 5.4, pra nao repetir numero por copia manual.
# ---------------------------------------------------------------------------


def gravar_resultado_medido(caminho_json, chave, dados):
    # Lock exclusivo (O_CREAT|O_EXCL, falha se ja existe) protege o read-modify-write:
    # sem isso, duas execucoes sobrepostas (ex.: dois harnesses rodando em paralelo
    # contra o mesmo ledger, cenario real quando multiplas ferramentas deste
    # diretorio compartilham um resultado-medido.json so) podem perder uma atualizacao
    # silenciosamente. Escrita em arquivo temporario + replace (atomico em POSIX)
    # evita tambem um arquivo corrompido/truncado se o processo morrer no meio da escrita.
    caminho_lock = caminho_json.parent / (caminho_json.name + ".lock")
    inicio_espera = time.monotonic()
    while True:
        try:
            fd = os.open(str(caminho_lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            break
        except FileExistsError:
            if time.monotonic() - inicio_espera > 30:
                raise RuntimeError(
                    f"Nao consegui obter o lock de {caminho_lock} em 30s -- outro "
                    "processo pode ter travado com o lock aberto (remova o arquivo "
                    ".lock manualmente se tiver certeza que nao ha outra execucao deste script rodando)."
                )
            time.sleep(0.1)
    try:
        atual = {}
        if caminho_json.exists():
            atual = json.loads(caminho_json.read_text(encoding="utf-8"))
        atual[chave] = dados
        caminho_tmp = caminho_json.parent / (caminho_json.name + f".{os.getpid()}.tmp")
        caminho_tmp.write_text(json.dumps(atual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        caminho_tmp.replace(caminho_json)
    finally:
        caminho_lock.unlink(missing_ok=True)


def rodar_baseline(mostrar_na_tela=True):
    conjunto_retido = m51.gerar_conjunto_teste_retido()
    baseline = avaliar_conjunto(conjunto_retido)
    if mostrar_na_tela:
        print("== Baseline: teste retido do Módulo 5.1 (mesmo gerador do treino, índices novos) ==")
        print(f"{baseline['schemasValidos']}/{baseline['total']} schema válido, {baseline['precisaoMedia']*100:.1f}% precisão média")
    return baseline


def rodar_round1(baseline):
    print()
    print("== Estresse: teste de invariância (formato real, nunca visto no template de treino) ==")
    conjunto_invariancia = gerar_conjunto_invariancia()
    estresse = avaliar_conjunto(conjunto_invariancia)
    for r in estresse["resultados"]:
        print(f"{r['id']} ({r['variacao']}): schema {'válido' if r['schemaValido'] else 'INVÁLIDO'}, precisão {r['precisao']*100:.0f}%")
    print(f"\n{estresse['schemasValidos']}/{estresse['total']} schema válido, {estresse['precisaoMedia']*100:.1f}% precisão média")

    print()
    queda_schema = baseline["schemasValidos"] / baseline["total"] - estresse["schemasValidos"] / estresse["total"]
    queda_precisao = baseline["precisaoMedia"] - estresse["precisaoMedia"]
    print(f"Queda de schema válido: {queda_schema*100:.1f} pontos percentuais")
    print(f"Queda de precisão média: {queda_precisao*100:.1f} pontos percentuais")

    medido_pct = round(min(estresse["schemasValidos"] / estresse["total"], estresse["precisaoMedia"]) * 100)
    sem_queda = queda_schema <= 0 and queda_precisao <= 0
    if sem_queda:
        medido = f"{medido_pct}% (zero queda de schema/precisão contra o baseline)"
    else:
        queda_precisao_str = f"{queda_precisao*100:.1f}".replace(".", ",")
        medido = f"{medido_pct}% (queda de {queda_precisao_str} pontos percentuais de precisão contra o baseline)"
    gravar_resultado_medido(
        Path(__file__).parent / "resultado-medido.json",
        "robusto-formato",
        {
            "medido": medido,
            "medidoPct": medido_pct,
            "n": estresse["total"],
            "medidoEm": date.today().isoformat(),
            "origem": "Módulo 5.3 (round 1)",
            "script": "overfitting_stress_test_tool.py",
        },
    )


def rodar_round2(baseline):
    print()
    print("== Estresse severo: variação estrutural (mensagem informal, valor por extenso, duas entidades) ==")
    conjunto_severo = gerar_conjunto_invariancia_severo()
    severo = avaliar_conjunto(conjunto_severo)
    for r in severo["resultados"]:
        print(f"{r['id']} ({r['variacao']}): schema {'válido' if r['schemaValido'] else 'INVÁLIDO'}, precisão {r['precisao']*100:.0f}%")
        if r["precisao"] < 1:
            print(f"    resposta bruta: {r['textoResposta']}")
    print(f"\n{severo['schemasValidos']}/{severo['total']} schema válido, {severo['precisaoMedia']*100:.1f}% precisão média")

    print()
    queda_schema_severo = baseline["schemasValidos"] / baseline["total"] - severo["schemasValidos"] / severo["total"]
    queda_precisao_severo = baseline["precisaoMedia"] - severo["precisaoMedia"]
    print(f"Queda de schema válido (severo): {queda_schema_severo*100:.1f} pontos percentuais")
    print(f"Queda de precisão média (severo): {queda_precisao_severo*100:.1f} pontos percentuais")

    print()
    falho = next((r for r in severo["resultados"] if r["precisao"] < 1), None)
    if falho is None:
        print("== Consistência: nenhum erro no round 2 desta vez, não há exemplo falho pra testar. ==")
        return
    print(f"== Consistência do erro real ({falho['id']}): mesma entrada, três chamadas separadas ==")
    exemplo_falho = next(e for e in conjunto_severo if e["metadata"]["id"] == falho["id"])
    consistencia = m51.avaliar_consistencia(exemplo_falho, 3)
    for i, r in enumerate(consistencia["respostas"], 1):
        print(f"  Chamada {i}: {r}")
    estabilidade = "estável" if consistencia["estavel"] else "instável"
    print(f"Respostas únicas: {consistencia['numeroRespostasUnicas']} de {len(consistencia['respostas'])} ({estabilidade})")
    if consistencia["estavel"]:
        print("Não é ruído aleatório: o modelo erra o mesmo campo, do mesmo jeito, toda vez.")
    else:
        print("Instável entre chamadas: esta execução não sustenta a alegação de erro consistente.")


# ---------------------------------------------------------------------------
# Remedicao estatistica do round 2 -- uma unica passada (rodar_round2) testa
# cada caso severo 1 vez so, evidencia fraca demais pro criterio de
# graduacao (a propria licao desta secao e que N pequeno engana: N=3 sugeriu
# um erro que N=58 nao confirmou). Este modo repete a avaliacao completa do
# conjunto severo N vezes e agrega, pra virar um ledger estatisticamente
# honesto em vez de uma amostra de 1.
#
# Custo real: N repeticoes x 6 chamadas ao modelo por repeticao. N=58 (o
# valor ja citado no TP/slide) significa 348 chamadas reais -- caro e
# demorado de proposito, e uma remedicao estatistica, nao o demo padrao.
# Pra so validar que o mecanismo funciona, rode com N baixo (ex.: 2).
# ---------------------------------------------------------------------------


def medir_robustez_estrutural(baseline, n=58):
    if not isinstance(n, int) or isinstance(n, bool) or n < 1:
        raise ValueError(f"medir_robustez_estrutural: N precisa ser um inteiro >= 1, recebi {n!r}.")
    print(f"== Remedição estatística do Round 2 (N={n} execuções completas do conjunto severo) ==")
    conjunto_severo = gerar_conjunto_invariancia_severo()
    total_casos = 0
    total_erros = 0
    for i in range(n):
        severo = avaliar_conjunto(conjunto_severo)
        erros_nesta_execucao = sum(1 for r in severo["resultados"] if not r["schemaValido"] or r["precisao"] < 1)
        total_casos += severo["total"]
        total_erros += erros_nesta_execucao
        print(f"  execução {i + 1}/{n}: {severo['schemasValidos']}/{severo['total']} schema válido, {severo['precisaoMedia']*100:.1f}% precisão")

    taxa_acerto = (total_casos - total_erros) / total_casos
    medido_pct = round(taxa_acerto * 100)
    print()
    print(f"Total: {total_erros}/{total_casos} chamadas com erro ({medido_pct}% de acerto), em {n} execuções completas.")

    if total_erros == 0:
        medido = f"{medido_pct}% (N={n} execuções, zero erros; uma checagem inicial com N pequeno pode sugerir um erro de fraseado que não se confirma em amostra maior)"
    else:
        medido = f"{medido_pct}% (N={n} execuções, {total_erros}/{total_casos} chamadas com erro)"

    gravar_resultado_medido(
        Path(__file__).parent / "resultado-medido.json",
        "robusto-estrutura",
        {
            "medido": medido,
            "medidoPct": medido_pct,
            "n": n,
            "medidoEm": date.today().isoformat(),
            "origem": f"Módulo 5.3 (round 2, N={n})",
            "script": "overfitting_stress_test_tool.py",
        },
    )
    return {"totalCasos": total_casos, "totalErros": total_erros, "medidoPct": medido_pct}


def main():
    # Uso: python3 overfitting_stress_test_tool.py [round0|round1|round2|round2-medir] [N]
    # Sem argumento roda tudo (testes + round0 + baseline + round1 + round2),
    # util pra verificacao standalone. "round0" e a sonda de capacidade
    # geral, independente do baseline/round1/round2; so nesse modo (e em
    # "tudo") os 2 testes extras da sonda entram na contagem, "round1"/
    # "round2" mostram sempre os 4 testes originais. "round1" roda o teste de
    # estresse de formato; "round2" roda o teste de estresse estrutural (mais
    # severo), sem repetir o baseline na tela. "round2-medir [N]" roda a
    # remedicao estatistica (N execucoes completas, padrao 58) e grava o
    # ledger -- nao faz parte do demo padrao, e a ferramenta de remedicao pra
    # quando o harness for alterado no futuro.
    modo = sys.argv[1] if len(sys.argv) > 1 else "tudo"

    if modo == "round2-medir":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 58
        baseline = rodar_baseline(False)
        medir_robustez_estrutural(baseline, n)
        return

    rodar_testes()

    if modo == "round0":
        print()
        rodar_testes_round0()
        print()
        rodar_round0()
        return

    if modo == "tudo":
        print()
        rodar_testes_round0()
        print()
        rodar_round0()

    if modo != "round2":
        print()
    baseline = rodar_baseline(modo != "round2")

    if modo in ("tudo", "round1"):
        rodar_round1(baseline)
    if modo in ("tudo", "round2"):
        rodar_round2(baseline)


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
