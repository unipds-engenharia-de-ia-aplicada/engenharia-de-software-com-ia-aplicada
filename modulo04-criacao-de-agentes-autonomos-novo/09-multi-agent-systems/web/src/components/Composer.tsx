import { useId, useState, type FormEvent, type KeyboardEvent } from "react";

type ComposerProps = {
  disabled?: boolean;
  sending?: boolean;
  awaitHumanApproval: boolean;
  onAwaitHumanApprovalChange: (value: boolean) => void;
  onSend: (message: string) => void;
  onAbort?: () => void;
};

export function Composer({
  disabled = false,
  sending = false,
  awaitHumanApproval,
  onAwaitHumanApprovalChange,
  onSend,
  onAbort,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const fieldId = useId();
  const toggleId = useId();

  function submit() {
    const message = value.trim();
    if (!message || disabled || sending) return;
    onSend(message);
    setValue("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer__field">
        <label htmlFor={fieldId}>Mensagem</label>
        <textarea
          id={fieldId}
          rows={3}
          value={value}
          disabled={disabled || sending}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Descreva o incidente ou peça ajuda ao OpsPilot…"
        />
      </div>
      <div className="composer__row">
        <label className="composer__toggle" htmlFor={toggleId}>
          <input
            id={toggleId}
            type="checkbox"
            checked={awaitHumanApproval}
            disabled={disabled || sending}
            onChange={(event) => onAwaitHumanApprovalChange(event.target.checked)}
          />
          Exigir aprovação
        </label>
        <div className="composer__actions">
          {sending ? (
            <button type="button" className="btn btn--secondary" onClick={onAbort}>
              Cancelar
            </button>
          ) : null}
          <button
            type="submit"
            className="btn btn--primary"
            disabled={disabled || sending || !value.trim()}
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </form>
  );
}
