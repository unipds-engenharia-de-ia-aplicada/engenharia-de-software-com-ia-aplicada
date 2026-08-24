# Unidade 6 — LangGraph e Workflows Complexos · Material de apoio visual

> Mostrado no preview de markdown do VS Code (`Cmd+Shift+V`), em tela cheia, num desktop à parte. As seções seguem a ordem do roteiro; o plano de aula cita cada uma por número e título.

---

<!-- Bloco 1.1 — abertura (câmera + esta seção) -->

## 1. O que vamos construir nesta unidade

| Peça                                       | O que é                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Roteador**                               | o nó classificador que lê o pedido e escolhe a estratégia sozinho — o cliente para de mandar `strategy` no body          |
| **Retry + fallback de modelo**             | retry: tentar de novo na falha passageira; fallback: o modelo reserva assume quando o primário cai (demonstrado ao vivo) |
| **Raio-X do grafo**                        | cada evento do trace assinado pelo **nó** que o produziu — o que a U7 vai persistir e periciar                           |
| **Paralelismo em ondas** _(seu exercício)_ | passos do plano que não dependem uns dos outros rodando ao mesmo tempo, em grupos — as ondas                             |

**Nada disso existe ainda — tudo nasce do zero, nesta unidade.**

---

<!-- Bloco 1.2 — estado, nós e arestas -->

## 2. LangGraph: estado, nós e arestas

```text
         ┌──────┐      ┌──────────┐  f(estado) = "b"   ┌──────┐
START →  │ nó 1 │  →   │ decisão  │ ─────────────────→ │ nó B │ → END
         └──────┘      └────┬─────┘                    └──────┘
                            │ f(estado) = "a"
                            ▼
                        ┌──────┐
                        │ nó A │ → END
                        └──────┘
```

- **Estado** — objeto tipado que atravessa a execução; cada nó lê e devolve atualizações
- **Nós** — funções que fazem trabalho: chamar modelo, rodar tool, montar contexto
- **Arestas** — quem vem depois de quem; as **condicionais** olham o estado e decidem

---

<!-- Bloco 1.2 — os 4 argumentos contra o if/else -->

## 3. Por que grafo, e não if/else

|                                                                       |                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **1 — O fluxo se desenha** · o grafo é dado; o diagrama sai do código | **2 — Decisão vira nó** · roteamento com entrada, saída e trace    |
| **3 — Resiliência localizada** · retry/fallback no nó instável        | **4 — Paralelismo declarativo** · ramos independentes rodam juntos |

Para usar depois: **checkpointing** (retomar do meio) e **interrupts** (aprovação humana — U7).

---

<!-- Bloco 1.2 — o grafo-alvo do OpsPilot (A seção da unidade) -->

## 4. O grafo-alvo do OpsPilot

```text
            ┌────────────────┐
 mensagem → │ contexto (U5)  │
            └──────┬─────────┘
            ┌──────▼─────────┐        route = "react"        ┌───────────┐
            │    roteador    │──────────────────────────────→│   react   │──┐
            │ (classificador)│   route = "plan-execute"      ├───────────┤  │
            │                │──────────────────────────────→│ plan-exec │──┤
            │                │   route = "reflect"           ├───────────┤  │
            │                │──────────────────────────────→│ +reflect  │──┤
            └────────────────┘                               └───────────┘  │
                                    ┌────────────────────────────────────┐  │
                                    │ resposta: grava histórico (U4),    │←─┘
                                    │ dispara refletor, monta métricas   │
                                    └────────────────────────────────────┘
```

---

<!-- Bloco 1.5 — a escada de defesas -->

## 5. A escada de defesas

```text
1. RETRY (com backoff)        falha transitória → nova tentativa
        │ esgotou
        ▼
2. FALLBACK DE MODELO         o reserva assume na mesma requisição
        │ tudo caiu
        ▼
3. DEGRADAÇÃO CONTROLADA      resposta honesta + 503 + rastro no trace
```

Custo e latência crescem a cada degrau — por isso a ordem: do mais barato ao mais caro.

---

<!-- Bloco 1.5 — onde mora a blindagem -->

## 6. Onde mora a blindagem: a fábrica única

```text
 roteador   react   plan-exec   reflect   crítico   sumarizador
     │        │         │          │         │           │
     └────────┴─────────┴────┬─────┴─────────┴───────────┘
                             ▼
              ┌────────────────────────────────┐
              │  createModel() — fábrica única │
              │  retry + fallback moram AQUI   │
              └────────────────────────────────┘
```

Uma edição, todos os nós blindados — a convenção das instructions (U2) se pagando.
