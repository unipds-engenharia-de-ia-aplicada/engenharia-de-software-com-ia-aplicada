import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { OPSPILOT_SYSTEM_PROMPT } from "./system-prompt.js";

const here = dirname(fileURLToPath(import.meta.url));

test("OPSPILOT_SYSTEM_PROMPT defines Resumo / Achados / Próximos passos", () => {
  assert.match(OPSPILOT_SYSTEM_PROMPT, /\*\*Resumo\*\*/);
  assert.match(OPSPILOT_SYSTEM_PROMPT, /\*\*Achados\*\*/);
  assert.match(OPSPILOT_SYSTEM_PROMPT, /\*\*Próximos passos\*\*/);
  assert.match(OPSPILOT_SYSTEM_PROMPT, /Relevant memories/);
  assert.match(OPSPILOT_SYSTEM_PROMPT, /Sem emojis/);
  assert.match(OPSPILOT_SYSTEM_PROMPT, /critical → high → medium → low/);
});

test("ReactStrategy wires OPSPILOT_SYSTEM_PROMPT into createReactAgent", () => {
  const src = readFileSync(join(here, "react.ts"), "utf8");
  assert.match(src, /OPSPILOT_SYSTEM_PROMPT/);
  assert.match(src, /prompt:\s*OPSPILOT_SYSTEM_PROMPT/);
});
