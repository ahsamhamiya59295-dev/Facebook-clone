import { mediaUrl } from '../../utils/helpers.js';

export default function UserAvatar({ user, src, name, size = 'md', className = '', showRing = false, online = false }) {
  const url = mediaUrl(src || user?.avatarUrl || user?.profile?.avatarUrl || null);
  const displayName = name || user?.fullName || user?.username || '?';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sizeClass = {
    sm: 'avatar-sm',
    md: 'avatar-md',
    lg: 'avatar-lg',
    xl: 'avatar-xl',
  }[size] || 'avatar-md';

  const style = url ? { backgroundImage: `url('${url}')` } : {};

  return (
    <span className={`avatar-wrap`} style={{ display: 'inline-block' }}>
      {url ? (
        <span
          className={`avatar ${sizeClass} ${showRing ? 'avatar-with-ring' : ''} ${className}`}
          style={style}
          aria-label={displayName}
        />
      ) : (
        <span className={`avatar initials ${sizeClass} ${className}`} aria-label={displayName}>
          {initials}
        </span>
      )}
      {online && <span className="online-dot" />}
    </span>
  );
}