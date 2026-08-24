export type AlertStatus = "firing" | "resolved";
export type IncidentStatus = "open" | "resolved";
export type Severity = "critical" | "high" | "medium" | "low";
export type ServiceTier = "critical" | "high" | "standard";
export type TraceEventType =
  | "thought"
  | "action"
  | "observation"
  | "plan"
  | "critique"
  | "answer"
  | "summarize";

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

/** Estimated prompt contribution by source (chars/4). Always five keys on /chat. */
export interface ContextBreakdown {
  system: number;
  history: number;
  memories: number;
  message: number;
  summary: number;
}

export interface ExecutionMetrics {
  llmCalls: number;
  latencyMs: number;
  /** Messages from conversation history injected into this turn (HTTP /chat). */
  historyMessages?: number;
  /** Semantic memories injected into this turn (HTTP /chat). */
  recalledMemories?: number;
  /** Real prompt tokens from LangChain usage (omit when unknown). */
  promptTokens?: number;
  /** Estimated tokens by context source (HTTP /chat). */
  contextBreakdown?: ContextBreakdown;
}

export interface MemoryFact {
  id: string;
  userId: string;
  fact: string;
  createdAt: number;
}

export interface RecalledMemory {
  id: string;
  fact: string;
  score: number;
}

export interface RememberResult {
  id: string;
  stored: boolean;
}

export interface Embedder {
  embed(text: string): Promise<Float32Array>;
}

export interface MemoryStore {
  remember(userId: string, fact: string): Promise<RememberResult>;
  recall(userId: string, query: string): Promise<RecalledMemory[]>;
  forget(userId: string, id: string): Promise<boolean>;
}

export type ConversationMessageRole = "user" | "assistant";

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  createdAt: number;
}

export interface ConversationSummaryRecord {
  conversationId: string;
  text: string;
  coveredCount: number;
  updatedAt: number;
}

export interface ConversationStore {
  create(): string;
  append(
    conversationId: string,
    role: ConversationMessageRole,
    content: string,
  ): ConversationMessage;
  lastMessages(conversationId: string, limit: number): ConversationMessage[];
  countMessages(conversationId: string): number;
  messagesAscending(
    conversationId: string,
    offset: number,
    limit: number,
  ): ConversationMessage[];
  getSummary(conversationId: string): ConversationSummaryRecord | null;
  upsertSummary(
    conversationId: string,
    text: string,
    coveredCount: number,
  ): void;
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
