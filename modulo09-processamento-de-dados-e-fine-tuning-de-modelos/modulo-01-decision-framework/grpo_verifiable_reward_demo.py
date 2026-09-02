"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 1.3 (cheatsheet, especie 7: GRPO / RFT)

Mecanismo real do GRPO (Group Relative Policy Optimization), o algoritmo
usado pelo DeepSeek-R1-Zero e pelo DeepSeek-R1 (DeepSeek-AI, arXiv 2501.12948;
formula original em DeepSeekMath, Shao et al., arXiv 2402.03300), e o mesmo
principio por tras do Reinforcement Fine-Tuning (RFT) da OpenAI (graders
no lugar de recompensa rule-based).

Este script NAO treina nada: reproduz de verdade o pedaco do algoritmo que
manda o sinal de aprendizado (amostragem de grupo -> recompensa verificavel
-> vantagem relativa ao grupo). A atualizacao de peso via gradiente de
politica fica fora de escopo, de proposito -- o ponto pedagogico e tornar
tangivel COMO o GRPO decide "reforcar" ou "penalizar" cada resposta do
grupo, nao reproduzir um loop de RL inteiro.

Chamadas reais ao Ollama local (nenhuma saida de modelo e inventada).
Uso: python3 grpo_verifiable_reward_demo.py
"""

import json
import re
import statistics
import urllib.error
import urllib.request

OLLAMA_URL = "http://localhost:11434/api/generate"
MODELO = "gemma4:e2b"
TAMANHO_GRUPO = 6  # G no paper original (DeepSeekMath usa G=64; aqui, G pequeno pra demo ao vivo)
TEMPERATURA = 1.0

DOCUMENTO_SINISTRO = """
Amplitude Seguros - Comunicado de Sinistro (documento digitalizado, OCR, scan parcialmente ilegivel)
Ref. anterior (cancelada): AS-2Q25-0988zi
Apolice vigente: A5-2026-1l44/7 (numero de dificil leitura no scan)
Segurado: M4rcos Vin1cius Alm3ida Te1xeira (OCR com ruido no nome)
Tipo de sinistro: Colisao veicular (ou possivelmente "Colisao e furto", trecho cortado)
Data do incidente: 12/O7/2026 ou 17/02/2026 (data ambigua, dois carimbos sobrepostos)
Valor estimado do reparo: R$ 8.45O,OO (sujeito a pericia, valor preliminar)
Status atual: Em analise pericial
"""

PROMPT_SCHEMA = f"""Extraia os dados do documento abaixo e responda APENAS com um JSON
valido, sem nenhum texto adicional, seguindo exatamente este schema:
{{"claimant_name": string, "claim_type": string, "incident_date": "DD/MM/AAAA",
"estimated_amount_brl": number, "status": string,
"prioridade": "alta se estimated_amount_brl > 5000, senao baixa"}}

Documento:
{DOCUMENTO_SINISTRO}
"""

GABARITO = {
    "claimant_name": "Marcos Vinícius Almeida Teixeira",
    "claim_type": "Colisao veicular",
    "incident_date": "12/07/2026",
    "estimated_amount_brl": 8450.00,
    "status": "Em analise pericial",
    "prioridade": "alta",
}

EPS = 1e-4  # guarda contra divisao por zero quando o grupo empata (std=0)


def chamar_ollama(prompt, temperatura):
    """Uma chamada real ao servidor Ollama local. Levanta erro se o servidor
    nao estiver rodando -- este demo nao tem fallback simulado."""
    payload = {
        "model": MODELO,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": temperatura},
    }
    req = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())["response"]


def extrair_json(texto):
    """Extrai o primeiro bloco JSON de uma resposta de texto livre do modelo."""
    match = re.search(r"\{.*\}", texto, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def recompensa_verificavel(candidato_json):
    """Recompensa mecanicamente checavel: fracao de campos exatamente corretos.
    Esta e a peca que o GRPO e o RFT chamam de 'grader' -- nao ha modelo de
    recompensa aprendido aqui, so comparacao direta contra o gabarito."""
    if candidato_json is None:
        return 0.0
    acertos = 0
    for campo, esperado in GABARITO.items():
        obtido = candidato_json.get(campo)
        if isinstance(esperado, float):
            try:
                acertos += abs(float(obtido) - esperado) < 0.01
            except (TypeError, ValueError):
                pass
        else:
            acertos += str(obtido).strip().lower() == str(esperado).strip().lower()
    return acertos / len(GABARITO)


def vantagem_relativa_ao_grupo(recompensas):
    """A_i = (r_i - media(r)) / desvio_padrao(r), o coracao do GRPO: o proprio
    grupo vira a linha de base, sem precisar de um modelo de valor (critic)
    separado como no PPO classico."""
    media = statistics.fmean(recompensas)
    desvio = statistics.pstdev(recompensas)
    desvio_efetivo = desvio if desvio > 0 else EPS
    return [(r - media) / desvio_efetivo for r in recompensas], media, desvio


# ----------------------------------------------------------------------------
# Testes automatizados (partes deterministicas: gabarito, recompensa, vantagem)
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
    print("== Testes: extracao de JSON ==")

    def t1():
        assert extrair_json('texto antes {"a": 1, "b": 2} texto depois') == {"a": 1, "b": 2}
    testar("extrai JSON cercado de texto solto", t1)

    def t2():
        assert extrair_json("isso nao tem json nenhum") is None
    testar("retorna None quando nao ha JSON", t2)

    def t3():
        assert extrair_json('{"a": invalido}') is None
    testar("retorna None pra JSON malformado, nao lanca excecao", t3)

    print()
    print("== Testes: recompensa verificavel ==")

    def t4():
        assert recompensa_verificavel(GABARITO) == 1.0
    testar("candidato identico ao gabarito recebe recompensa 1.0", t4)

    def t5():
        assert recompensa_verificavel(None) == 0.0
    testar("candidato sem JSON valido recebe recompensa 0.0", t5)

    def t6():
        parcial = dict(GABARITO)
        parcial["status"] = "campo errado"
        r = recompensa_verificavel(parcial)
        assert abs(r - 5 / 6) < 1e-9
    testar("um campo errado em seis reduz a recompensa proporcionalmente (5/6)", t6)

    def t7():
        candidato = dict(GABARITO)
        candidato["estimated_amount_brl"] = 8450.001
        assert recompensa_verificavel(candidato) == 1.0
    testar("diferenca de arredondamento (<0,01) no valor ainda conta como acerto", t7)

    print()
    print("== Testes: vantagem relativa ao grupo (GRPO) ==")

    def t8():
        vantagens, media, desvio = vantagem_relativa_ao_grupo([1.0, 0.5, 0.0])
        assert abs(media - 0.5) < 1e-9
        assert vantagens[0] > 0 and vantagens[2] < 0
        assert abs(vantagens[1]) < 1e-9
    testar("grupo com variancia real: melhor recompensa vira vantagem positiva, pior vira negativa", t8)

    def t9():
        vantagens, media, desvio = vantagem_relativa_ao_grupo([0.83, 0.83, 0.83, 0.83])
        assert desvio == 0.0
        assert all(v == 0.0 for v in vantagens)
    testar("grupo degenerado (todas as recompensas iguais) produz vantagem zero em todo mundo, sem dividir por zero", t9)

    def t10():
        vantagens, _, _ = vantagem_relativa_ao_grupo([1.0, 1.0, 0.0, 0.0])
        assert vantagens[0] == vantagens[1] and vantagens[2] == vantagens[3]
        assert vantagens[0] > vantagens[2]
    testar("recompensas iguais dentro do grupo recebem exatamente a mesma vantagem", t10)

    print()
    print(f"Total: {total_testes} teste(s), {total_testes - testes_com_falha} passou(passaram), {testes_com_falha} falhou(falharam).")


# ----------------------------------------------------------------------------
# Execucao principal: amostragem real de grupo + calculo real de vantagem
# ----------------------------------------------------------------------------

def main():
    rodar_testes()

    print()
    print("== Amostragem real de grupo (o passo que o GRPO chama de 'rollout') ==")
    print(f"Modelo: {MODELO}  |  tamanho do grupo G={TAMANHO_GRUPO}  |  temperatura={TEMPERATURA}")
    print("Mesma pergunta, G respostas reais e independentes, geradas agora, sem cache.\n")

    try:
        chamar_ollama("teste de conexao", 0.1)
    except (urllib.error.URLError, ConnectionError) as erro:
        print(f"Nao foi possivel conectar ao Ollama local em {OLLAMA_URL}: {erro}")
        print("Rode 'ollama serve' e confirme que o modelo 'gemma4:e2b' esta disponivel ('ollama list').")
        return

    recompensas = []
    candidatos = []
    for i in range(TAMANHO_GRUPO):
        try:
            bruto = chamar_ollama(PROMPT_SCHEMA, TEMPERATURA)
        except (urllib.error.URLError, ConnectionError, TimeoutError) as erro:
            print(f"  [{i}] chamada ao Ollama falhou ({erro}) -- pulando esta amostra do grupo.")
            continue
        candidato = extrair_json(bruto)
        r = recompensa_verificavel(candidato)
        recompensas.append(r)
        candidatos.append(candidato)

        divergencias = []
        if candidato:
            for campo, esperado in GABARITO.items():
                obtido = candidato.get(campo)
                if isinstance(esperado, float):
                    try:
                        bate = abs(float(obtido) - esperado) < 0.01
                    except (TypeError, ValueError):
                        bate = False
                else:
                    bate = str(obtido).strip().lower() == str(esperado).strip().lower()
                if not bate:
                    divergencias.append(f"{campo}={obtido!r} (gabarito={esperado!r})")
        print(f"  [{i}] recompensa={r:.2f}  json_valido={candidato is not None}  divergencias={divergencias}")

    if not recompensas:
        print("\nNenhuma amostra completou (todas as chamadas ao Ollama falharam) -- sem grupo pra calcular vantagem.")
        return

    vantagens, media, desvio = vantagem_relativa_ao_grupo(recompensas)

    print(f"\nGrupo completo: media(r)={media:.3f}  desvio_padrao(r)={desvio:.3f}")

    if desvio == 0.0:
        print()
        print("GRUPO DEGENERADO: todas as G respostas receberam a mesma recompensa.")
        print("Isso NAO e um bug deste script -- e um limite real e documentado do GRPO:")
        print("quando o grupo inteiro acerta (ou erra) igual, a vantagem de todo mundo")
        print("vira zero e o sinal de aprendizado desaparece nessa rodada. O paper DAPO")
        print("(Yu et al., arXiv 2503.14476) descreve exatamente esse caso e propoe")
        print("'amostragem dinamica' como correcao: descartar grupos unanimes e")
        print("re-amostrar ate achar um grupo com variancia real.")
    else:
        print()
        print(f"{'i':>2}  {'recompensa':>10}  {'vantagem A_i':>13}  interpretacao")
        print("-" * 74)
        for i, (r, a) in enumerate(zip(recompensas, vantagens)):
            if a > 0:
                tag = "reforcaria essa resposta (A>0)"
            elif a < 0:
                tag = "penalizaria essa resposta (A<0)"
            else:
                tag = "neutro (A=0)"
            print(f"{i:>2}  {r:>10.2f}  {a:>13.3f}  {tag}")

    print()
    print("A_i = (r_i - media(r)) / desvio_padrao(r) e o sinal que o GRPO usa pra")
    print("atualizar a politica -- o proprio grupo vira a linha de base, sem precisar")
    print("de um modelo de valor (critic) separado como no PPO/RLHF classico.")
    print("Nenhum peso do modelo foi atualizado por este script -- fim do demo.")


if __name__ == "__main__":
    main()

# Ahirton Lopes - Fine-Tuning Toolkit, UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
