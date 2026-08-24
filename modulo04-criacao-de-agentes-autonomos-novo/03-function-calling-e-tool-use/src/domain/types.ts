export type AlertStatus = "firing" | "resolved";
export type IncidentStatus = "open" | "resolved";
export type Severity = "critical" | "high" | "medium" | "low";
export type ServiceTier = "critical" | "high" | "standard";
export type TraceEventType = "thought" | "action" | "observation" | "plan" | "critique" | "answer";

export interface Service {
  name: string;
  tier: ServiceTier;
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
  summary: string | null;
}

export interface Runbook {
  service: string;
  content: string;
}

export interface SeedPayload {
  services: Service[];
  alerts: Alert[];
  runbooks: Runbook[];
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
  /** Messages from conversation history injected into this turn (HTTP /chat). */
  historyMessages?: number;
}

export type ConversationMessageRole = "user" | "assistant";

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  createdAt: number;
}

export interface ConversationStore {
  create(): string;
  append(
    conversationId: string,
    role: ConversationMessageRole,
    content: string,
  ): ConversationMessage;
  lastMessages(conversationId: string, limit: number): ConversationMessage[];
}

/** Input for a single strategy turn (current message + prior history). */
export interface StrategyRunInput {
  message: string;
  history: ConversationMessage[];
}

export interface StrategyResult {
  answer: string;
  trace: TraceEvent[];
  metrics: ExecutionMetrics;
}

export interface ReasoningStrategy {
  readonly name: string;
  run(input: StrategyRunInput): Promise<StrategyResult>;
}

export interface OpsStore {
  seed(data: SeedPayload): void;
  getAlerts(status?: AlertStatus): Alert[];
  getIncidents(status?: IncidentStatus): Incident[];
  createIncident(data: Pick<Incident, "title" | "service" | "severity">): Incident;
  resolveIncident(id: string, summary?: string | null): Incident;
  getRunbook(service: string): Runbook;
}
