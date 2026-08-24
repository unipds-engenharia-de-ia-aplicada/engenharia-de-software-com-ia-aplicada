import { useEffect, useId, useRef, useState } from "react";
import { isValidApiBaseUrl } from "../api/config";

type SettingsGearProps = {
  open: boolean;
  apiBaseUrl: string;
  onOpen: () => void;
  onClose: () => void;
  onSave: (url: string) => void;
};

export function SettingsGear({
  open,
  apiBaseUrl,
  onOpen,
  onClose,
  onSave,
}: SettingsGearProps) {
  const titleId = useId();
  const fieldId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(apiBaseUrl);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(apiBaseUrl);
      setError(null);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open, apiBaseUrl]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleSave() {
    if (!isValidApiBaseUrl(draft)) {
      setError("Informe uma URL http(s) válida");
      inputRef.current?.focus();
      return;
    }
    onSave(draft);
    onClose();
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--icon"
        aria-label="Configurações"
        onClick={onOpen}
      >
        ⚙
      </button>
      {open ? (
        <div className="drawer-backdrop" role="presentation" onClick={onClose}>
          <div
            className="settings"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId}>Configurações</h2>
            <div className="settings__field">
              <label htmlFor={fieldId}>URL da API</label>
              <input
                ref={inputRef}
                id={fieldId}
                value={draft}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setError(null);
                }}
              />
              {error ? (
                <p id={errorId} className="field-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <div className="settings__actions">
              <button type="button" className="btn btn--secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSave}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
