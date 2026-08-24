# Contract — War Room UI: `handoff` no "Ver raciocínio"

Extensão do contrato de `016-war-room-web`.

## Schema do cliente (`web/src/api/types.ts`)

- `traceEventSchema.type` ganha `"handoff"` no enum.
- Campo novo opcional: `to: z.string().optional()`.
- Sem o literal no enum, o parse do turno inteiro falharia — atualização é obrigatória junto do backend.

## Render (`web/src/components/TraceDrawer.tsx`)

Item de trace com `type === "handoff"` renderiza:

1. Tipo visível (`handoff`) — como os demais tipos.
2. Destino em destaque: linha `para: {to}` (mesmo padrão visual das linhas `nó:` / `tool:` existentes).
3. Brief legível: `content` como corpo do item.
4. Nó produtor: `nó: supervisor` (comportamento existente, sem mudança).

Regras de design (`.cursor/rules/design.mdc`): tokens semânticos (sem hex solto), escala de espaçamento 4px, contraste AA em ambos os temas; handoff distinguível sem depender só de cor.

## Comportamento preservado

- Tipos existentes renderizam como hoje (zero regressão).
- Drawer mantém acessibilidade atual: `role="dialog"`, foco no fechar, Escape fecha.
- Empty state inalterado.

## Teste (`TraceDrawer.test.tsx` / Vitest + Testing Library)

- Dado um evento `{ type: "handoff", node: "supervisor", to: "analista", content: "..." }`, o drawer exibe o tipo, o destino e o brief.
- Turno misto (route + handoff + thought/action) renderiza todos os itens na ordem recebida.
