import { UnknownStrategyError } from "../domain/errors.js";
import type { ReasoningStrategy } from "../domain/types.js";
import { withReflection, type ReflectionOpts } from "../strategies/reflect.js";

export type StrategyRegistry = ReadonlyMap<string, ReasoningStrategy>;

export function createRegistry(
  entries: Record<string, ReasoningStrategy>,
): StrategyRegistry {
  return new Map(Object.entries(entries));
}

export function resolveStrategy(
  registry: StrategyRegistry,
  name: string,
  reflect: boolean,
  reflectionOpts?: ReflectionOpts,
): ReasoningStrategy {
  const base = registry.get(name);
  if (!base) {
    throw new UnknownStrategyError(name);
  }
  if (!reflect) {
    return base;
  }
  return withReflection(base, reflectionOpts ?? {});
}

export function listStrategies(registry: StrategyRegistry): string[] {
  return [...registry.keys()];
}
