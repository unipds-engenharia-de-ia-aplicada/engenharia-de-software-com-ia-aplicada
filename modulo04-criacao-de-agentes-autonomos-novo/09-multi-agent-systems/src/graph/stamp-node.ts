import type { TraceEvent } from "../domain/types.js";

/** Stamp (or overwrite) `node` on every event. */
export function stampNode(node: string, events: TraceEvent[]): TraceEvent[] {
  return events.map((event) => ({ ...event, node }));
}
