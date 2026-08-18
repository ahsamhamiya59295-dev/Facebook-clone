export default function Skeleton({ lines = 3, variant = 'card' }) {
  if (variant === 'avatar') {
    return (
      <span className="avatar skeleton-avatar" aria-hidden="true" />
    );
  }
  return (
    <div className={`card skeleton-card ${variant === 'text' ? 'skeleton-card' : ''}`} aria-hidden="true">
      <div className="skeleton-avatar" style={{ marginBottom: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton skeleton-line ${i === lines - 1 ? 'short' : ''}`} />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="user-row" aria-hidden="true">
      <span className="skeleton-avatar skeleton" />
      <div style={{ flex: 1 }}>
        <div className="skeleton skeleton-line" style={{ width: '40%' }} />
        <div className="skeleton skeleton-line short" />
      </div>
    </div>
  );
}