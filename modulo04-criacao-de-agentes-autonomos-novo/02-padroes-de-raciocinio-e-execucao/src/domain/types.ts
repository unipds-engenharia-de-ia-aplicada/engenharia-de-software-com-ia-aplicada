export type AlertStatus = "firing" | "resolved";
export type IncidentStatus = "open" | "resolved";
export type Severity = "critical" | "high" | "medium" | "low";
export type TraceEventType = "thought" | "action" | "observation" | "plan" | "critique" | "answer";

export interface Service {
  name: string;
}

export interface Alert {
  id: string;
  service: string;
  description: string;
  severity: Severity;
  status: AlertStatus;
}

export interface Incident {
  id: string;
  title: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  createdAt: number;
  resolvedAt: number | null;
}

export interface TraceEvent {
  type: TraceEventType;
  content: string;
  tool?: string;
  toolArgs?: Record<string, unknown>;
  /** Reflection-layer critique round (1-based). */
  round?: number;
  /** Reflection-layer critic verdict. */
  approved?: boolean;
  /** Unix timestamp (ms) when the critique event was recorded. */
  timestampMs?: number;
}

export interface ExecutionMetrics {
  llmCalls: number;
  latencyMs: number;
}

export interface StrategyResult {
  answer: string;
  trace: TraceEvent[];
  metrics: ExecutionMetrics;
}

export interface ReasoningStrategy {
  readonly name: string;
  run(input: string): Promise<StrategyResult>;
}

export interface IStore {
  getAlerts(status?: AlertStatus): Alert[];
  createIncident(data: Pick<Incident, "title" | "service" | "severity">): Incident;
  resolveIncident(id: string): Incident;
}
