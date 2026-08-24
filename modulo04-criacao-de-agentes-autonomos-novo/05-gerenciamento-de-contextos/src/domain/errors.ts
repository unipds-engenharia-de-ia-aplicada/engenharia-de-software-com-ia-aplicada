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
