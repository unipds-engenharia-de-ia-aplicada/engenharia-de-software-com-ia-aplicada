# Quickstart: Reflection Layer Validation

**Phase 1 output for** `specs/002-reflection-layer/plan.md`

Guia de validação end-to-end da Reflection Layer. Foca em **como verificar** que a feature funciona corretamente — não inclui código de implementação completo.

---

## Pré-requisitos

- Node.js 22 LTS instalado
- `npm install` executado na raiz do projeto
- Para validação com LLM real: `OPENROUTER_API_KEY` configurada em `.env`

---

## 1. Validação unitária (sem rede)

### Executar a suite completa de testes

```bash
npm test
```

**Saída esperada**: todos os testes em `src/strategies/reflect.test.ts` passando (sem erros, sem falhas).

### Cenários cobertos pelos testes

| Cenário | Verificação |
|---------|-------------|
| Aprovação imediata | Estratégia base chamada 1 vez; `metrics.llmCalls = base.llmCalls + 1`; trace contém 1 evento `critique` com `approved: true` |
| Reprovação com 1 ciclo | Estratégia base chamada 2 vezes; trace contém 2 eventos `critique`; segundo com `approved: true` |
| Reprovação até `maxReflections: 2` | Estratégia base chamada 3 vezes; trace contém 2 eventos `critique`; `metrics.llmCalls = 3 + 2 = 5` |
| `maxReflections: 0` | Estratégia base chamada 1 vez; crítico nunca invocado; trace sem eventos `critique` |
| Erro na estratégia base | Exceção propaga sem ser capturada pelo decorator |
| Feedback vazio | Contexto injetado contém `"(sem feedback adicional)"`; sem crash |
| Fail-safe do crítico (JSON inválido) | `approved: true` retornado; sem crash; execução encerra normalmente |

### Verificar typecheck

```bash
npm run typecheck
```

**Saída esperada**: zero erros, zero warnings. Confirma que os novos campos opcionais em `TraceEvent` e os tipos exportados de `reflect.ts` são compatíveis com `strict: true`.

---

## 2. Validação de métricas acumuladas

Os testes unitários validam as métricas diretamente via mocks. Referência:

- Ver [data-model.md](../data-model.md#entidade-conceitual-reflectiondecorator) — seção "Acumulação de métricas"
- Ver [contracts/reflect-decorator.md](../contracts/reflect-decorator.md#acumulação-de-métricas) — exemplos com `maxReflections: 2`

Para confirmar SC-003 (aprovação imediata = +1 `llmCalls`):

```typescript
// no teste: mock de base retorna llmCalls: 2, mock de crítico aprova
const result = await reflect.run("test");
assert.strictEqual(result.metrics.llmCalls, 3); // 2 (base) + 1 (crítico)
```

---

## 3. Validação do trace

Para confirmar SC-004 (N reflexões = N eventos `critique` com `round` incrementado):

```typescript
const critiques = result.trace.filter(e => e.type === "critique");
assert.strictEqual(critiques.length, N);
critiques.forEach((e, i) => assert.strictEqual(e.round, i + 1));
```

---

## 4. Validação da Arena (sem rede — instanciação)

Confirma SC-005 — a Arena reconhece `reflect:react` e `reflect:plan-and-execute` sem erro de runtime:

```bash
npm test
```

O arquivo `src/strategies/reflect.test.ts` inclui testes de instanciação que verificam:
- `strategy.name === "reflect:react"`
- `strategy.name === "reflect:plan-and-execute"`

---

## 5. Validação end-to-end com LLM real (opcional — requer `OPENROUTER_API_KEY`)

```bash
# Comparar react com reflect:react
npm run arena -- --strategies react,reflect:react --input "Quais serviços têm alertas críticos e qual a severidade?"

# Comparar todas as quatro estratégias
npm run arena -- --strategies react,reflect:react,plan-and-execute,reflect:plan-and-execute
```

**O que observar**:
- Saída com header `Strategy: reflect:react` (não apenas `react`)
- Eventos `[critique]` aparecem no trace quando há reflexão
- `LLM calls` da versão `reflect:*` é maior ou igual à versão base (≥ base + 1)
- A `Answer` da versão refletida é mais detalhada quando o crítico reprovei a primeira resposta

**Nota**: Sem `OPENROUTER_API_KEY`, a Arena exibe `Error: OPENROUTER_API_KEY environment variable is required` e sai com código 1. Isso é comportamento esperado e não indica bug na reflection layer.

---

## Referências

- [data-model.md](../data-model.md) — entidades `CritiqueResult`, `ReflectionOpts`, extensão de `TraceEvent`
- [contracts/reflect-decorator.md](../contracts/reflect-decorator.md) — API TypeScript completa de `withReflection`
- [contracts/arena-cli.md](../contracts/arena-cli.md) — extensão da CLI da Arena
