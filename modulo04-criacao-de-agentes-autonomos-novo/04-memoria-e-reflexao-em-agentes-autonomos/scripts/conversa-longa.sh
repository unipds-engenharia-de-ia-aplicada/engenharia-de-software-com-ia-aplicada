#!/usr/bin/env bash
# 30 turnos de plantão no mesmo conversationId via POST /chat.
# Turno 3 planta a decisão "o freeze de deploys termina dia 15".
# Estima tokens por turno (~4 chars/token) e imprime conversationId no final.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
USER_ID="${USER_ID:-u-plantao}"
CHARS_PER_TOKEN="${CHARS_PER_TOKEN:-4}"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq é obrigatório" >&2
  exit 1
fi

# Mensagens de plantão (turno 3 é especial — plantada abaixo)
MESSAGES=(
  "liste os alertas firing agora"
  "quantos incidentes open temos?"
  "PLANTAR" # placeholder — substituído no loop
  "o checkout está lento; o que os alertas dizem?"
  "abra um incidente high para checkout: p99 acima de 2s"
  "consulte o runbook de payments"
  "há algo firing em notifications?"
  "liste incidentes open do serviço auth"
  "resumo do que já vimos no plantão"
  "resolva o incidente mais antigo open se fizer sentido"
  "status do catalog: alertas e incidentes"
  "prefiro ver críticos antes dos demais"
  "liste todos os alertas resolved recentes"
  "o que falta para estabilizar payments?"
  "consultar_runbook de checkout por favor"
  "há incidentes medium ou low abertos?"
  "atualize o status: quantos firing ainda?"
  "compare alertas firing vs incidentes open"
  "lembrete: mantenha o foco em serviços critical tier"
  "algum runbook para notifications?"
  "liste incidentes resolved se houver"
  "o plantão precisa de um resumo executivo curto"
  "verifique se payments ainda tem alerta crítico"
  "próximos passos sugeridos para o turno"
  "auth tem algo firing?"
  "reabra o contexto: freeze e prioridades"
  "liste alertas firing de checkout e payments"
  "ainda faz sentido manter o incidente de catalog?"
  "status geral do plantão agora"
  "feche com um resumo final do plantão"
)

estimate_tokens() {
  local text="$1"
  local chars
  chars=$(printf '%s' "$text" | wc -c | tr -d ' ')
  # arredonda para cima: (chars + CHARS_PER_TOKEN - 1) / CHARS_PER_TOKEN
  echo $(( (chars + CHARS_PER_TOKEN - 1) / CHARS_PER_TOKEN ))
}

CONVERSATION_ID=""
TOTAL_TOKENS=0

echo "Base: $BASE_URL | userId: $USER_ID | turnos: ${#MESSAGES[@]}"
echo "Estimativa: ~${CHARS_PER_TOKEN} chars/token (request+response)"
echo "---"

for i in "${!MESSAGES[@]}"; do
  turn=$((i + 1))
  message="${MESSAGES[$i]}"
  if [[ "$message" == "PLANTAR" ]]; then
    message="decisão do plantão: o freeze de deploys termina dia 15 — registre e considere isso daqui pra frente"
  fi

  body=$(jq -n \
    --arg message "$message" \
    --arg userId "$USER_ID" \
    --arg cid "$CONVERSATION_ID" \
    '
      { message: $message, userId: $userId }
      + (if $cid == "" then {} else { conversationId: $cid } end)
    ')

  response=$(curl -sS -X POST "${BASE_URL}/chat" \
    -H 'content-type: application/json' \
    -d "$body")

  cid=$(echo "$response" | jq -r '.conversationId // empty')
  answer=$(echo "$response" | jq -r '.answer // empty')
  error=$(echo "$response" | jq -r '.error // empty')

  if [[ -n "$error" || -z "$cid" ]]; then
    echo "Turno $turn FALHOU: $response" >&2
    exit 1
  fi

  CONVERSATION_ID="$cid"
  req_tokens=$(estimate_tokens "$message")
  res_tokens=$(estimate_tokens "$answer")
  turn_tokens=$((req_tokens + res_tokens))
  TOTAL_TOKENS=$((TOTAL_TOKENS + turn_tokens))

  printf 'turno %02d | req≈%d tok | res≈%d tok | total_turno≈%d | recalled=%s | hist=%s\n' \
    "$turn" \
    "$req_tokens" \
    "$res_tokens" \
    "$turn_tokens" \
    "$(echo "$response" | jq -r '.metrics.recalledMemories // 0')" \
    "$(echo "$response" | jq -r '.metrics.historyMessages // 0')"

  if [[ "$turn" -eq 3 ]]; then
    echo "  → plantado: o freeze de deploys termina dia 15"
  fi
done

echo "---"
echo "tokens_estimados_total≈${TOTAL_TOKENS}"
echo "conversationId=${CONVERSATION_ID}"
