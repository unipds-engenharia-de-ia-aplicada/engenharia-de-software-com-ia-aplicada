import { AsyncLocalStorage } from "node:async_hooks";

export interface ModelTelemetry {
  primaryModel: string;
  fallbackModel?: string;
  modelUsed?: string;
  /** True when the reserve model completed successfully after primary failure. */
  fallbackUsed: boolean;
  /** Model ids that reported LLM end (success) this turn, in order. */
  successOrder: string[];
}

const storage = new AsyncLocalStorage<ModelTelemetry>();

export function createEmptyTelemetry(
  primaryModel: string,
  fallbackModel?: string,
): ModelTelemetry {
  return {
    primaryModel,
    fallbackModel,
    fallbackUsed: false,
    successOrder: [],
  };
}

export function runWithModelTelemetry<T>(
  telemetry: ModelTelemetry,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(telemetry, fn);
}

export function getModelTelemetry(): ModelTelemetry | undefined {
  return storage.getStore();
}

export function recordModelSuccess(modelId: string): void {
  const store = storage.getStore();
  if (!store) {
    return;
  }
  store.modelUsed = modelId;
  store.successOrder.push(modelId);
  if (store.fallbackModel && modelId === store.fallbackModel) {
    store.fallbackUsed = true;
  }
}

export function recordFallbackUsed(): void {
  const store = storage.getStore();
  if (!store) {
    return;
  }
  store.fallbackUsed = true;
  if (store.fallbackModel) {
    store.modelUsed = store.fallbackModel;
  }
}
