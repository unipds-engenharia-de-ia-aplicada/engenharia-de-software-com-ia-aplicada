type ApprovalCardProps = {
  summary: string;
  status: "pending" | "approved" | "denied" | "error";
  errorMessage?: string | null;
  busy?: boolean;
  onApprove: () => void;
  onDeny: () => void;
};

export function ApprovalCard({
  summary,
  status,
  errorMessage,
  busy = false,
  onApprove,
  onDeny,
}: ApprovalCardProps) {
  return (
    <section className="approval-card" aria-label="Ação pendente">
      <h2>Ação pendente</h2>
      <p>{summary}</p>
      {status === "pending" ? (
        <div className="approval-card__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={onApprove}
          >
            Aprovar
          </button>
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy}
            onClick={onDeny}
          >
            Negar
          </button>
        </div>
      ) : (
        <p className="approval-card__status" role="status">
          {status === "approved"
            ? "Aprovado"
            : status === "denied"
              ? "Negado"
              : "Erro na decisão"}
        </p>
      )}
      {errorMessage ? (
        <div className="banner banner--danger" role="alert">
          {errorMessage}
        </div>
      ) : null}
    </section>
  );
}
