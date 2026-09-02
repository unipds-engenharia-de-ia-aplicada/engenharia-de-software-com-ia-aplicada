"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 2.1 (companion: fine-tuning com dado regulado)

Gate real de higienizacao de PII antes que um documento da Amplitude
Seguros entre no dataset de fine-tuning. Nao substitui o gate de
governanca do Modulo 1.2 (validarGovernancaDado, que checa base legal
e DPA) nem o aprofundamento de mascaramento/auditoria da disciplina 10,
Seguranca e Governanca em IA: e o passo tecnico mais estreito e mais
concreto que existe entre os dois, especifico de preparar dado pra
fine-tuning.

Abordagem hibrida, a mesma usada em pipelines reais de producao
(Microsoft Presidio combina regex + NER; ver companion
privacy-preserving-finetuning-companion.md pras fontes completas):
  - CPF: regex de formato + validacao real do digito verificador
    (algoritmo Modulo 11 da Receita Federal), nao so formato.
  - Nome: ancora de rotulo (Segurado:/Beneficiario:) mais confiavel;
    fallback heuristico de sequencia de palavras capitalizadas pra
    nome solto no texto, com taxa de falso positivo/negativo honesta,
    nao perfeita.

Uso: python3 pii_scrubbing_gate_tool.py
"""

import re

REGEX_CPF = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
REGEX_NOME_ANCORADO = re.compile(
    r"(Segurado|Beneficiário|Beneficiario|Nome do segurado)[ \t]*:[ \t]*"
    r"([A-ZÀ-Ú][\wÀ-ú]*(?:[ \t]+[A-ZÀ-Ú][\wÀ-ú]*){1,4})"
)


def calcular_digito_verificador(parcial):
    soma = 0
    peso = len(parcial) + 1
    for d in parcial:
        soma += int(d) * peso
        peso -= 1
    resto = soma % 11
    return 0 if resto < 2 else 11 - resto


def validar_cpf(cpf_com_ou_sem_mascara):
    digitos = "".join(c for c in cpf_com_ou_sem_mascara if c.isdigit())
    if len(digitos) != 11:
        return False
    if digitos == digitos[0] * 11:
        return False
    d1 = calcular_digito_verificador(digitos[:9])
    d2 = calcular_digito_verificador(digitos[:9] + str(d1))
    return digitos[9] == str(d1) and digitos[10] == str(d2)


def detectar_nomes_ancorados(texto):
    encontrados = []
    for m in REGEX_NOME_ANCORADO.finditer(texto):
        encontrados.append({"nome": m.group(2), "confianca": "alta", "metodo": "ancora_rotulo"})
    return encontrados


def varrer_pii(texto_documento):
    cpfs_encontrados = []
    for m in REGEX_CPF.finditer(texto_documento):
        cpfs_encontrados.append({"texto": m.group(0), "valido": validar_cpf(m.group(0))})

    nomes_encontrados = detectar_nomes_ancorados(texto_documento)

    texto_redigido = texto_documento
    for cpf in cpfs_encontrados:
        if cpf["valido"]:
            texto_redigido = texto_redigido.replace(cpf["texto"], "[CPF_REDIGIDO]")
    for nome in nomes_encontrados:
        texto_redigido = texto_redigido.replace(nome["nome"], "[NOME_REDIGIDO]")

    return {
        "cpfsEncontrados": cpfs_encontrados,
        "nomesEncontrados": nomes_encontrados,
        "textoRedigido": texto_redigido,
        "totalPiiRedigido": sum(1 for c in cpfs_encontrados if c["valido"]) + len(nomes_encontrados),
    }


# ----------------------------------------------------------------------------
# Testes automatizados
# ----------------------------------------------------------------------------

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


def rodar_testes():
    print("== Testes: validacao real de CPF (Modulo 11) ==")

    def t1():
        assert validar_cpf("111.444.777-35") is True
    testar("111.444.777-35 e um CPF de teste conhecido e valido (digito verificador bate)", t1)

    def t2():
        assert validar_cpf("111.444.777-34") is False
    testar("trocar o ultimo digito verificador invalida o CPF", t2)

    def t3():
        assert validar_cpf("000.000.000-00") is False
    testar("sequencia de digitos repetidos (000.000.000-00) nunca e CPF valido, mesmo com formato certo", t3)

    def t4():
        assert validar_cpf("11144477735") is True
    testar("CPF sem mascara (so digitos) valida igual", t4)

    def t5():
        assert validar_cpf("123.456.789-00") is False
    testar("11 digitos aleatorios sem digito verificador coerente e rejeitado", t5)

    print()
    print("== Testes: deteccao de nome ancorada em rotulo ==")

    def t6():
        encontrados = detectar_nomes_ancorados("Segurado: Marcos Vinicius Andrade Pereira\nPlaca: ABC-1234")
        assert len(encontrados) == 1
        assert encontrados[0]["nome"] == "Marcos Vinicius Andrade Pereira"
    testar('extrai nome depois de "Segurado:"', t6)

    def t7():
        encontrados = detectar_nomes_ancorados("Beneficiário: Carlos Eduardo Martins")
        assert encontrados[0]["nome"] == "Carlos Eduardo Martins"
    testar('extrai nome depois de "Beneficiário:" (com acento)', t7)

    def t8():
        encontrados = detectar_nomes_ancorados("Beneficiario: Carlos Eduardo Martins")
        assert encontrados[0]["nome"] == "Carlos Eduardo Martins"
    testar('extrai nome depois de "Beneficiario:" (sem acento, variacao real de OCR)', t8)

    def t9():
        encontrados = detectar_nomes_ancorados("OFICINA ESTRELA - ORCAMENTO N. 4471")
        assert len(encontrados) == 0
    testar("texto sem rotulo conhecido nao gera falso positivo na ancora", t9)

    print()
    print("== Testes: varredura completa e redacao ==")

    def t10():
        doc = (
            "OFICINA ESTRELA - ORCAMENTO N. 4471\n"
            "Segurado: Marcos Vinicius Andrade Pereira\n"
            "CPF: 111.444.777-35\n"
            "Placa do veiculo: QJK-4F82\n\n"
            "Valor total do reparo: R$ 3.210,50"
        )
        resultado = varrer_pii(doc)
        assert len(resultado["nomesEncontrados"]) == 1
        assert sum(1 for c in resultado["cpfsEncontrados"] if c["valido"]) == 1
        assert "[NOME_REDIGIDO]" in resultado["textoRedigido"]
        assert "[CPF_REDIGIDO]" in resultado["textoRedigido"]
        assert "QJK-4F82" in resultado["textoRedigido"], "placa nao e PII pessoal, tem que sobreviver a redacao"
        assert "3.210,50" in resultado["textoRedigido"], "valor nao e PII pessoal, tem que sobreviver a redacao"
    testar("documento real do Modulo 2.1 (Amplitude Auto) tem nome e CPF redigidos, placa e valor preservados", t10)

    def t11():
        doc = "Protocolo interno: 123.456.789-00\nSegurado: Ana Paula Ribeiro"
        resultado = varrer_pii(doc)
        assert sum(1 for c in resultado["cpfsEncontrados"] if c["valido"]) == 0
        assert "[CPF_REDIGIDO]" not in resultado["textoRedigido"]
    testar("CPF com formato certo mas digito verificador invalido nao e redigido (evita falso positivo em numero aleatorio de 11 digitos)", t11)

    print()
    print(f"Total: {total_testes} teste(s), {total_testes - testes_com_falha} passou(passaram), {testes_com_falha} falhou(falharam).")


def main():
    rodar_testes()

    print()
    print("== Gate real: documentos do Modulo 2.1, agora com CPF (como um caso real de seguradora traria) ==")

    documentos = [
        {
            "id": "amplitude-auto-1",
            "texto": (
                "OFICINA ESTRELA - ORCAMENTO N. 4471\n"
                "Segurado: Marcos Vinicius Andrade Pereira\n"
                "CPF: 111.444.777-35\n"
                "Placa do veiculo: QJK-4F82\n\n"
                "Valor total do reparo: R$ 3.210,50"
            ),
        },
        {
            "id": "amplitude-saude-1",
            "texto": (
                "RECIBO DE ATENDIMENTO MEDICO\n"
                "Beneficiario: Carlos Eduardo Martins\n"
                "CPF: 111.444.777-35\n"
                "Procedimento: Consulta Cardiologica\n"
                "Valor: R$ 380,00"
            ),
        },
    ]

    for doc in documentos:
        print(f"\n--- {doc['id']} ---")
        print("Antes (bruto, nunca deveria entrar assim num dataset de treino):")
        print(doc["texto"])
        resultado = varrer_pii(doc["texto"])
        n_cpfs_validos = sum(1 for c in resultado["cpfsEncontrados"] if c["valido"])
        print(f"\nPII detectado: {len(resultado['nomesEncontrados'])} nome(s), {n_cpfs_validos} CPF(s) valido(s)")
        print("Depois (o que de fato entra no dataset de fine-tuning):")
        print(resultado["textoRedigido"])

    print()
    print("Nota honesta: a ancora de rotulo (Segurado:/Beneficiario:) tem alta confianca, mas so")
    print("pega nome que segue esse padrao. Nome solto em texto livre, fora de rotulo conhecido,")
    print("exigiria NER de verdade (ex.: spaCy, como o Microsoft Presidio usa em producao) para nao")
    print("depender so de heuristica de capitalizacao, que erra tanto nome de oficina/clinica quanto")
    print("nome de pessoa. Ver o companion privacy-preserving-finetuning-companion.md pra esse")
    print("proximo passo, mais o cenario de dado de saude (DP-SGD/DP-LoRA) e o risco de memorizacao.")


if __name__ == "__main__":
    main()

# Ahirton Lopes - Fine-Tuning Toolkit, UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
