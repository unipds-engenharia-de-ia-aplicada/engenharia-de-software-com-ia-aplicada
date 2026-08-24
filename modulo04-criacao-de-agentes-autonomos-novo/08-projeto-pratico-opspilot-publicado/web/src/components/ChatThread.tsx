import type { TraceEventView } from "../api/types";
import { EmptyState } from "./EmptyState";

export type ChatTurnView = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  httpStatus?: 200 | 202 | "error" | null;
  requestId?: string | null;
  trace?: TraceEventView[];
  approvalId?: string | null;
  errorMessage?: string | null;
};

type ChatThreadProps = {
  turns: ChatTurnView[];
  onViewReasoning?: (turnId: string) => void;
  onRetry?: () => void;
};

export function ChatThread({ turns, onViewReasoning, onRetry }: ChatThreadProps) {
  if (turns.length === 0) {
    return (
      <EmptyState
        title="Nenhuma mensagem ainda"
        message="Envie a primeira mensagem para começar o plantão na War Room."
      />
    );
  }

  return (
    <ol className="thread" aria-live="polite">
      {turns.map((turn) => (
        <li key={turn.id} className={`bubble bubble--${turn.role}`}>
          <div className="bubble__meta">
            {turn.role === "user"
              ? "Você"
              : turn.role === "assistant"
                ? "OpsPilot"
                : "Sistema"}
          </div>
          <div className="bubble__content">{turn.content}</div>
          {turn.errorMessage ? (
            <div className="banner banner--danger" role="alert">
              <strong>Erro</strong>
              <p>{turn.errorMessage}</p>
              {onRetry ? (
                <button type="button" className="btn btn--secondary" onClick={onRetry}>
                  Tentar de novo
                </button>
              ) : null}
            </div>
          ) : null}
          {turn.role === "assistant" && (turn.trace?.length ?? 0) > 0 && onViewReasoning ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onViewReasoning(turn.id)}
            >
              Ver raciocínio
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
