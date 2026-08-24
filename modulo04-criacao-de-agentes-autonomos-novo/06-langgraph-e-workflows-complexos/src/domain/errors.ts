export class IncidentNotFoundError extends Error {
  constructor(id: string) {
    super(`Incident not found: ${id}`);
    this.name = "IncidentNotFoundError";
  }
}

export class RunbookNotFoundError extends Error {
  constructor(service: string) {
    super(`Runbook not found: ${service}`);
    this.name = "RunbookNotFoundError";
  }
}

export class UnknownStrategyError extends Error {
  readonly strategy: string;

  constructor(strategy: string) {
    super(`Unknown strategy: ${strategy}`);
    this.name = "UnknownStrategyError";
    this.strategy = strategy;
  }
}

export class ChatTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Chat timed out after ${timeoutMs}ms`);
    this.name = "ChatTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class ConversationNotFoundError extends Error {
  readonly conversationId: string;

  constructor(conversationId: string) {
    super(`Conversation not found: ${conversationId}`);
    this.name = "ConversationNotFoundError";
    this.conversationId = conversationId;
  }
}

export class EmbeddingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EmbeddingError";
  }
}

export class InvalidMemoryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMemoryInputError";
  }
}

/** Primary (+ optional fallback) model exhausted — HTTP 503 on /chat. */
export class ModelUnavailableError extends Error {
  constructor(message = "All configured language models failed") {
    super(message);
    this.name = "ModelUnavailableError";
  }
}

/** Audit request id not found — HTTP 404 on GET /requests/:id. */
export class RequestNotFoundError extends Error {
  readonly code = "request_not_found" as const;
  readonly requestId: string;

  constructor(requestId: string) {
    super(`Request not found: ${requestId}`);
    this.name = "RequestNotFoundError";
    this.requestId = requestId;
  }
}

/** Pending approval missing or already consumed — HTTP 404 on POST /approvals/:id. */
export class ApprovalNotFoundError extends Error {
  readonly code = "approval_not_found" as const;
  readonly approvalId: string;

  constructor(approvalId: string) {
    super(`Approval not found: ${approvalId}`);
    this.name = "ApprovalNotFoundError";
    this.approvalId = approvalId;
  }
}
