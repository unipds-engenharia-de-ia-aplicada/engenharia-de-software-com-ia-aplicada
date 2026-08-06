"""
Ahirton Lopes · AI Architecture Toolkit
Artefato de Demo - Módulo 1.3

Ferramenta: Framework de Decisão de Três Perguntas (checklist do Módulo 1.3).
Lógica pura, 100% determinística, sem IA: não chama nenhum modelo, não faz
nenhuma chamada de rede, não precisa de Ollama nem de chave de API alguma.
É a árvore de decisão do checklist (decision-framework-checklist.md, mesma
pasta) virando código, pergunta por pergunta.

Contraste pedagógico proposital com o protótipo do Módulo 2.5
(react-agent-prototype): lá a decisão depende de julgamento de linguagem
natural feito por um modelo, não é 100% determinística. Aqui a decisão é
uma árvore de três perguntas booleanas, então vira código com confiança
total, sem ambiguidade nenhuma. Esse contraste é o próprio valor
pedagógico deste artefato.

Versão oficial: JavaScript (decision-framework-tool.js), mesmo padrão de
nomenclatura kebab-case/snake_case já usado nos outros pares JS/Python da
disciplina. Esta versão em Python é material de referência espelhado, para
quem quiser comparar ou usar noutro contexto.

Requer: apenas biblioteca padrão do Python (módulos unittest e typing, já
embutidos). Nenhuma dependência externa, nenhuma chamada de rede.
Uso:    python3 decision_framework_tool.py
"""

import sys
import unittest
from typing import Any, Dict, List


def classificar_tarefa(p1: bool, p2: bool, p3: bool) -> str:
    """
    Aplica a árvore de três perguntas do checklist, na ordem exata do documento.

    P1 - Existe uma regra finita que cobre mais de 90% dos casos REAIS (já
         observados, não hipotéticos)?
    P2 - O erro é caro E a ação é irreversível (não dá pra desfazer depois)?
    P3 - O comportamento da tarefa muda de acordo com o contexto de entrada?

    A árvore tem curto-circuito, igual ao checklist original: se p1 é True,
    o "Fim da decisão" já aconteceu e p2/p3 nem chegam a ser avaliados (os
    parâmetros são recebidos, mas os valores deles não influenciam o
    resultado). O mesmo vale para p3 quando p1 é False e p2 é True.
    """
    if p1:
        return "Regra determinística"
    if p2:
        return "Agente com Approval Gate obrigatório"
    if p3:
        return "Agente autônomo, com observabilidade completa"
    return "Regra determinística (mesmo parecendo complexa, se é enumerável, é regra)"


def decompor_tarefa_hibrida(subtarefas: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Recebe uma lista de subtarefas, cada uma um dict com as chaves "nome",
    "tipo" (string livre, ex.: "Extração/Interpretação" ou "Decisão de
    Negócio"), "p1", "p2" e "p3" (as mesmas colunas do template "Decompondo
    uma tarefa híbrida" do checklist), e devolve uma lista nova, na mesma
    ordem, com uma chave a mais em cada item: "classificacao", o resultado de
    aplicar classificar_tarefa() naquela subtarefa especificamente.

    Não é uma lógica nova: é a mesma árvore de três perguntas, reaproveitada
    via classificar_tarefa(), aplicada item a item. A ideia central do
    checklist é justamente essa: decompor a tarefa "que parece uma coisa só"
    antes de classificar, porque uma tarefa híbrida raramente é 100% agente
    ou 100% regra de ponta a ponta.

    Escolha de projeto: a função não modifica os dicts de entrada (retorna
    dicts novos, com os campos originais copiados mais "classificacao"). Isso
    evita efeito colateral surpresa em quem chama a função passando a
    própria lista de referência do time.
    """
    resultado = []
    for subtarefa in subtarefas:
        classificacao = classificar_tarefa(subtarefa["p1"], subtarefa["p2"], subtarefa["p3"])
        resultado.append({**subtarefa, "classificacao": classificacao})
    return resultado


# ---------------------------------------------------------------------------
# Testes automatizados (unittest, biblioteca padrão do Python; sem instalar
# nada). Rodam sempre que o arquivo é executado diretamente, antes da demo.
# ---------------------------------------------------------------------------


class TestClassificarTarefa(unittest.TestCase):
    """Bloco 1: as 4 combinações da árvore pura, extraídas do checklist."""

    def test_p1_true_com_qualquer_p2_p3_e_regra_deterministica(self):
        for p2 in (True, False):
            for p3 in (True, False):
                with self.subTest(p2=p2, p3=p3):
                    self.assertEqual(classificar_tarefa(True, p2, p3), "Regra determinística")

    def test_p1_false_p2_true_com_qualquer_p3_e_approval_gate(self):
        for p3 in (True, False):
            with self.subTest(p3=p3):
                self.assertEqual(
                    classificar_tarefa(False, True, p3),
                    "Agente com Approval Gate obrigatório",
                )

    def test_p1_false_p2_false_p3_true_e_agente_autonomo(self):
        self.assertEqual(
            classificar_tarefa(False, False, True),
            "Agente autônomo, com observabilidade completa",
        )

    def test_p1_false_p2_false_p3_false_e_regra_deterministica_enumeravel(self):
        self.assertEqual(
            classificar_tarefa(False, False, False),
            "Regra determinística (mesmo parecendo complexa, se é enumerável, é regra)",
        )


class TestDecomporTarefaHibrida(unittest.TestCase):
    """
    Bloco 2: decomposição da tarefa híbrida de referência do checklist
    (seção "Referência: TrialForge - Emenda de Protocolo").

    Usa só as duas subtarefas da tabela de referência que mapeiam limpo pra
    uma única resposta p1/p2/p3: "Extrair o que mudou entre versões do
    protocolo" e "Classificar o tipo de emenda (administrativa/substancial)".

    As outras duas linhas da tabela do checklist ("Rotear pela criticidade"
    e "Regenerar documentos afetados") misturam regra e gate condicional de
    um jeito mais sutil, que não mapeia limpo pra uma única resposta
    p1/p2/p3 sem inventar valores só pra forçar um teste a passar. Isso é
    uma limitação real e honesta da árvore pura de três perguntas (ela
    classifica o componente predominante de uma subtarefa já bem recortada,
    não decide composições internas de regra+gate dentro da mesma
    subtarefa), não um bug desta implementação.
    """

    def test_decompoe_as_duas_subtarefas_de_referencia_do_checklist(self):
        subtarefas = [
            {
                "nome": "Extrair o que mudou entre versões do protocolo",
                "tipo": "Extração/Interpretação",
                # Não é regra enumerável: é extração/interpretação de
                # linguagem natural sobre o texto do protocolo.
                "p1": False,
                # A extração em si não causa, diretamente, um erro caro e
                # irreversível.
                "p2": False,
                # O comportamento muda bastante conforme o que de fato
                # mudou entre as duas versões do protocolo.
                "p3": True,
            },
            {
                "nome": "Classificar o tipo de emenda (administrativa/substancial)",
                "tipo": "Decisão de Negócio",
                # Segue um critério fixo definido pela ANVISA, coberto no
                # vídeo do Módulo 1.3: regra finita cobre os casos reais.
                "p1": True,
                "p2": False,
                "p3": False,
            },
        ]

        resultado = decompor_tarefa_hibrida(subtarefas)

        self.assertEqual(
            resultado[0]["classificacao"], "Agente autônomo, com observabilidade completa"
        )
        self.assertEqual(resultado[1]["classificacao"], "Regra determinística")

        # A decomposição preserva os campos originais (nome, tipo, p1..p3)
        # e só acrescenta "classificacao"; não descarta nem reordena nada, e
        # não modifica a lista/dicts de entrada (ver docstring da função).
        self.assertEqual(len(resultado), len(subtarefas))
        self.assertEqual(resultado[0]["nome"], subtarefas[0]["nome"])
        self.assertEqual(resultado[1]["tipo"], subtarefas[1]["tipo"])
        self.assertIsNot(resultado[0], subtarefas[0])
        self.assertNotIn("classificacao", subtarefas[0])


# ---------------------------------------------------------------------------
# Demo (roda quando o arquivo é executado diretamente, depois dos testes)
# ---------------------------------------------------------------------------


def executar_demo() -> None:
    """
    Demo legível no terminal: os 4 casos do Bloco 1 e a decomposição da
    tarefa híbrida de referência do Bloco 2. Mesmo espírito da Missão
    Prática: mostrar o mecanismo funcionando, não só os testes passando
    silenciosamente.
    """
    print("=" * 72)
    print("Bloco 1: as 4 combinações da árvore pura de três perguntas")
    print("=" * 72)

    casos_bloco_1 = [
        ("P1=True,  P2=False, P3=False", True, False, False),
        ("P1=False, P2=True,  P3=False", False, True, False),
        ("P1=False, P2=False, P3=True ", False, False, True),
        ("P1=False, P2=False, P3=False", False, False, False),
    ]
    for rotulo, p1, p2, p3 in casos_bloco_1:
        print(f"  {rotulo} -> {classificar_tarefa(p1, p2, p3)}")

    print()
    print("=" * 72)
    print("Bloco 2: decompondo a tarefa híbrida de referência")
    print("(TrialForge - Emenda de Protocolo)")
    print("=" * 72)

    subtarefas = [
        {
            "nome": "Extrair o que mudou entre versões do protocolo",
            "tipo": "Extração/Interpretação",
            "p1": False,
            "p2": False,
            "p3": True,
        },
        {
            "nome": "Classificar o tipo de emenda (administrativa/substancial)",
            "tipo": "Decisão de Negócio",
            "p1": True,
            "p2": False,
            "p3": False,
        },
    ]
    for subtarefa in decompor_tarefa_hibrida(subtarefas):
        print(f"  Subtarefa: {subtarefa['nome']}")
        print(f"    Tipo: {subtarefa['tipo']}")
        print(f"    P1={subtarefa['p1']}, P2={subtarefa['p2']}, P3={subtarefa['p3']}")
        print(f"    Classificação: {subtarefa['classificacao']}")
        print()

    print(
        "  Nota: as outras duas linhas da tabela de referência do checklist\n"
        "  ('Rotear pela criticidade' e 'Regenerar documentos afetados') não\n"
        "  entram nesta demo de propósito, pelo mesmo motivo documentado em\n"
        "  TestDecomporTarefaHibrida: misturam regra e gate condicional de um\n"
        "  jeito que não mapeia limpo pra uma única resposta P1/P2/P3."
    )


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    resultado_testes = unittest.TextTestRunner(verbosity=2).run(suite)

    if not resultado_testes.wasSuccessful():
        print("\n[Testes falharam] Corrigindo a lógica antes de rodar a demo.")
        sys.exit(1)

    print()
    executar_demo()

# Ahirton Lopes · AI Architecture Toolkit — UNIPDS: Arquitetura de Sistemas com IA
# Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager
