import { randomUUID } from "node:crypto";

import type {
  ApprovalStore,
  ChatRequestSnapshot,
  PendingApproval,
} from "../domain/types.js";

export class MemoryApprovalStore implements ApprovalStore {
  private readonly pending = new Map<string, PendingApproval>();

  save(input: Omit<PendingApproval, "approvalId"> & { approvalId?: string }): PendingApproval {
    const approvalId = input.approvalId ?? randomUUID();
    const record: PendingApproval = {
      approvalId,
      requestId: input.requestId,
      createdAt: input.createdAt,
      summary: input.summary,
      chatRequest: input.chatRequest,
      conversationId: input.conversationId,
    };
    this.pending.set(approvalId, record);
    return record;
  }

  get(approvalId: string): PendingApproval | null {
    return this.pending.get(approvalId) ?? null;
  }

  take(approvalId: string): PendingApproval | null {
    const found = this.pending.get(approvalId) ?? null;
    if (found) {
      this.pending.delete(approvalId);
    }
    return found;
  }
}

export function truncateSummary(message: string, max = 240): string {
  const trimmed = message.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export type { ChatRequestSnapshot };
