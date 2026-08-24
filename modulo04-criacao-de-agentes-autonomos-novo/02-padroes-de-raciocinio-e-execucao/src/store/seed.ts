import type { Alert, IStore, Service } from "../domain/types.js";
import { InMemoryStore } from "./in-memory-store.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";

import seedData from "./seed-data.json" with { type: "json" };

const serviceSchema = z.object({
  name: z.string().min(1),
});

const alertSchema = z.object({
  id: z.string().min(1),
  service: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["firing", "resolved"]),
});

const seedSchema = z.object({
  services: z.array(serviceSchema).min(1),
  alerts: z.array(alertSchema).min(1),
});

const parsedSeed = seedSchema.parse(seedData);
const services: Service[] = parsedSeed.services;
const alerts: Alert[] = parsedSeed.alerts;

export function seedStore(store: IStore): void {
  if (!(store instanceof InMemoryStore)) {
    throw new Error("seedStore requires InMemoryStore in this feature scope.");
  }
  store.seed({ services, alerts });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(currentFile)) {
  const store = new InMemoryStore();
  seedStore(store);
  console.log(`Seeded ${store.getAlerts().length} alerts.`);
}
