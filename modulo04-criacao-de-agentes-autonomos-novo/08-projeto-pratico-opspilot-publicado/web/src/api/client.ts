import {
  approvalSuccessSchema,
  chatPendingSchema,
  chatSuccessSchema,
  type ApprovalSuccess,
  type ChatPending,
  type ChatSuccess,
} from "./types";

export class ApiClientError extends Error {
  readonly status: number | null;
  readonly body: unknown;

  constructor(message: string, status: number | null = null, body?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.body = body;
  }
}

export function joinBase(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export type PostChatInput = {
  baseUrl: string;
  message: string;
  userId?: string;
  conversationId?: string | null;
  awaitHumanApproval?: boolean;
  signal?: AbortSignal;
};

export type PostChatResult =
  | { kind: "success"; status: 200; data: ChatSuccess }
  | { kind: "pending"; status: 202; data: ChatPending };

export async function postChat(input: PostChatInput): Promise<PostChatResult> {
  let response: Response;
  try {
    response = await fetch(joinBase(input.baseUrl, "/chat"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: input.signal,
      body: JSON.stringify({
        message: input.message,
        userId: input.userId ?? "war-room",
        conversationId: input.conversationId ?? undefined,
        awaitHumanApproval: input.awaitHumanApproval ?? false,
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiClientError("Não foi possível falar com a API");
  }

  const json: unknown = await response.json().catch(() => null);

  if (response.status === 202) {
    const parsed = chatPendingSchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiClientError("Resposta 202 inválida", 202, json);
    }
    return { kind: "pending", status: 202, data: parsed.data };
  }

  if (response.status === 200) {
    const parsed = chatSuccessSchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiClientError(
        "Resposta sem answer válida",
        200,
        json,
      );
    }
    if (!parsed.data.answer) {
      throw new ApiClientError("Resposta sem answer", 200, json);
    }
    return { kind: "success", status: 200, data: parsed.data };
  }

  throw new ApiClientError(
    `Falha no chat (HTTP ${response.status})`,
    response.status,
    json,
  );
}

export type PostApprovalInput = {
  baseUrl: string;
  approvalId: string;
  decision: "approve" | "deny";
  userId?: string;
  signal?: AbortSignal;
};

export async function postApproval(
  input: PostApprovalInput,
): Promise<ApprovalSuccess> {
  let response: Response;
  try {
    response = await fetch(
      joinBase(input.baseUrl, `/approvals/${input.approvalId}`),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: input.signal,
        body: JSON.stringify({
          decision: input.decision,
          userId: input.userId ?? "war-room",
        }),
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiClientError("Não foi possível falar com a API");
  }

  const json: unknown = await response.json().catch(() => null);
  if (response.status !== 200) {
    throw new ApiClientError(
      `Falha na aprovação (HTTP ${response.status})`,
      response.status,
      json,
    );
  }

  const parsed = approvalSuccessSchema.safeParse(json);
  if (!parsed.success || !parsed.data.answer) {
    throw new ApiClientError("Resposta de aprovação inválida", 200, json);
  }
  return parsed.data;
}
