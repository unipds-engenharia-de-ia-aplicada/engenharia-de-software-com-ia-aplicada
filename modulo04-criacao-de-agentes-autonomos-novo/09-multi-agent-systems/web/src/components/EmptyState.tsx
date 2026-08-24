type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__message">{message}</p>
      {actionLabel && onAction ? (
        <button type="button" className="btn btn--secondary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
