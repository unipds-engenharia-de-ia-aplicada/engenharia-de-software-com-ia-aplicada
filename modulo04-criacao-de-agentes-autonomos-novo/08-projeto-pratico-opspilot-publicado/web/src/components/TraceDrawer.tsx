import { useEffect, useId, useRef } from "react";
import type { TraceEventView } from "../api/types";
import { EmptyState } from "./EmptyState";

type TraceDrawerProps = {
  open: boolean;
  events: TraceEventView[];
  onClose: () => void;
};

export function TraceDrawer({ open, events, onClose }: TraceDrawerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer__header">
          <h2 id={titleId}>Raciocínio</h2>
          <button
            ref={closeRef}
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            aria-label="Fechar raciocínio"
          >
            Fechar
          </button>
        </header>
        {events.length === 0 ? (
          <EmptyState
            title="Sem eventos de raciocínio"
            message="Este turno não trouxe eventos de trace."
            actionLabel="Fechar"
            onAction={onClose}
          />
        ) : (
          <ol className="trace-list">
            {events.map((event, index) => (
              <li key={`${event.type}-${index}`} className="trace-item">
                <div className="trace-item__type">{event.type}</div>
                <div className="trace-item__content">{event.content}</div>
                <div className="trace-item__node">nó: {event.node}</div>
                {event.tool ? (
                  <div className="trace-item__node">tool: {event.tool}</div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
