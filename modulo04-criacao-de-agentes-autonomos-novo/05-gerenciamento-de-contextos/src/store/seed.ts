import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";

import type { Alert, OpsStore, Runbook, SeedPayload, Service } from "../domain/types.js";
import { InMemoryStore } from "./in-memory-store.js";

import seedData from "./seed-data.json" with { type: "json" };

const serviceSchema = z.object({
  name: z.string().min(1),
  tier: z.enum(["critical", "high", "standard"]),
});

const alertSchema = z.object({
  id: z.string().min(1),
  service: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["firing", "resolved"]),
});

const runbookSchema = z.object({
  service: z.string().min(1),
  content: z.string().min(1),
});

const seedSchema = z.object({
  services: z.array(serviceSchema).min(1),
  alerts: z.array(alertSchema).min(1),
  runbooks: z.array(runbookSchema).min(1),
});

const parsedSeed = seedSchema.parse(seedData);

export const mercadinhoSeed: SeedPayload = {
  services: parsedSeed.services as Service[],
  alerts: parsedSeed.alerts as Alert[],
  runbooks: parsedSeed.runbooks as Runbook[],
};

/** Idempotent baseline seed for any OpsStore implementation. */
export function seedOpsStore(store: OpsStore, data: SeedPayload = mercadinhoSeed): void {
  store.seed(data);
}

/** @deprecated Prefer seedOpsStore — kept for call-site compatibility during migration. */
export function seedStore(store: OpsStore, data?: SeedPayload): void {
  seedOpsStore(store, data);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(currentFile)) {
  const store = new InMemoryStore();
  seedOpsStore(store);
  console.log(`Seeded ${store.getAlerts().length} alerts.`);
}
