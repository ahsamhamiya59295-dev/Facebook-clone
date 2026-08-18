import { memo, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { groupService } from '../../services';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';

// Mirrors the helper's LeftSidebar.tsx exactly: profile row, 8 primary links,
// the extended links revealed under "See more" with a fade-in, and a
// "Your shortcuts" section.

const PRIMARY = [
  { to: '/friends', icon: 'users', label: 'Friends', color: '#2d88ff' },
  { to: '/saved', icon: 'bookmark', label: 'Saved', color: '#9360f7' },
  { to: '/groups', icon: 'users', label: 'Groups', color: '#1877f2' },
  { to: '/reels', icon: 'tv', label: 'Video', color: '#2d88ff' },
  { to: '/marketplace', icon: 'store', label: 'Marketplace', color: '#1877f2' },
  { to: '/', icon: 'clock', label: 'Memories', color: '#1877f2' },
  { to: '/groups', icon: 'flag_filled', label: 'Pages', color: '#f02849' },
  { to: '/events', icon: 'calendar', label: 'Events', color: '#f35369' },
];

const EXTRA = [
  { to: '/gaming', icon: 'gamepad2', label: 'Play games', color: '#1877f2' },
  { to: '/', icon: 'barChart3', label: 'Ads Manager', color: '#2d88ff' },
  { to: '/', icon: 'heartHandshake', label: 'Fundraisers', color: '#f02849' },
  { to: '/', icon: 'creditCard', label: 'Orders and payments', color: '#45bd62' },
  { to: '/messages', icon: 'messageSquareHeart', label: 'Messenger Kids', color: '#2d88ff' },
  { to: '/reels', icon: 'video', label: 'Reels', color: '#f02849' },
  { to: '/gaming', icon: 'flame', label: 'Gaming video', color: '#2d88ff' },
  { to: '/', icon: 'shieldCheck', label: 'Privacy Center', color: '#2d88ff' },
  { to: '/', icon: 'building2', label: 'Meta Business Suite', color: '#1877f2' },
  { to: '/', icon: 'layers', label: 'Feeds (Most Recent)', color: '#2d88ff' },
  { to: '/', icon: 'sparkles', label: 'Meta AI Assistant', color: '#2d88ff' },
];

const SHORTCUT_LIMIT = 4;

function SidebarItem({ to, icon, label, color, onClick }) {
  const isInternal = !onClick;
  const content = (
    <>
      <span className="sidebar-item-icon" style={{ color }}>
        <Icon name={icon} size={20} />
      </span>
      <span className="sidebar-item-label ellipsis">{label}</span>
    </>
  );
  if (isInternal) {
    return (
      <Link to={to} className="sidebar-item" aria-label={label}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className="sidebar-item" onClick={onClick} aria-label={label}>
      {content}
    </button>
  );
}

export default memo(function SidebarLeft() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [shortcuts, setShortcuts] = useState([]);

  useEffect(() => {
    let alive = true;
    groupService
      .all()
      .then((data) => {
        if (alive) setShortcuts((data.groups || []).slice(0, SHORTCUT_LIMIT));
      })
      .catch(() => {
        if (alive) setShortcuts([]);
      });
    return () => { alive = false; };
  }, []);

  if (!user) return null;

  return (
    <aside className="sidebar sidebar-left" aria-label="Left sidebar">
      <Link
        to={`/profile/${user.username}`}
        className="sidebar-item sidebar-item-profile"
      >
        <UserAvatar user={user} size="md" className="sidebar-profile-avatar" />
        <span className="sidebar-item-label ellipsis">{user.fullName}</span>
      </Link>

      {PRIMARY.map((item) => (
        <SidebarItem key={item.label} {...item} />
      ))}

      {expanded && (
        <div className="sidebar-section sidebar-section-extended">
          {EXTRA.map((item) => (
            <SidebarItem key={item.label} {...item} />
          ))}
        </div>
      )}

      <button
        type="button"
        className="sidebar-item sidebar-item-toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="sidebar-item-icon sidebar-item-icon-toggle">
          <Icon name={expanded ? 'chevron_up' : 'chevron_down'} size={20} />
        </span>
        <span className="sidebar-item-label">See {expanded ? 'less' : 'more'}</span>
      </button>

      <div className="sidebar-divider" />

      {shortcuts.length > 0 && (
        <div className="sidebar-section">
          <h4 className="sidebar-section-title">Your shortcuts</h4>
          {shortcuts.map((g) => (
            <Link to={`/groups/${g.id}`} key={g.id} className="sidebar-shortcut">
              <span className="sidebar-shortcut-thumb">
                {g.coverUrl ? (
                  <img src={g.coverUrl} alt={g.name} loading="lazy" referrerPolicy="no-referrer" />
                ) : (
                  <Icon name="group" size={20} />
                )}
              </span>
              <span className="sidebar-shortcut-text">
                <span className="sidebar-shortcut-title ellipsis">{g.name}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
});