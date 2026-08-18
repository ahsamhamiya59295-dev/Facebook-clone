import { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useAuthData } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';

// Right sidebar: "Contacts" with online-friend rows. Birthdays + suggestions
// live on the helper's profile page rather than here.

export default memo(function SidebarRight() {
  const { user } = useAuth();
  const { friends } = useAuthData();
  const { onlineUsers } = useSocket();
  const navigate = useNavigate();

  const [contactQuery, setContactQuery] = useState('');

  if (!user) return null;

  const contacts = (friends || [])
    .filter((f) => (contactQuery ? f.fullName.toLowerCase().includes(contactQuery.toLowerCase()) : true))
    .sort((a, b) => {
      const ao = onlineUsers.has(a.id) ? 0 : 1;
      const bo = onlineUsers.has(b.id) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return a.fullName.localeCompare(b.fullName);
    });

  return (
    <aside className="sidebar sidebar-right" aria-label="Right sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-head">
          <h4 className="sidebar-section-title">Contacts</h4>
          <div className="sidebar-section-actions">
            <button type="button" className="sidebar-mini-btn" aria-label="Start a video room" onClick={() => navigate('/messages')}>
              <Icon name="video" size={14} />
            </button>
            <button type="button" className="sidebar-mini-btn" aria-label="Search contacts" onClick={() => {
              const next = document.querySelector('.sidebar-right .sidebar-section input');
              if (next) next.focus();
            }}>
              <Icon name="search" size={14} />
            </button>
            <button type="button" className="sidebar-mini-btn" aria-label="More">
              <Icon name="more" size={14} />
            </button>
          </div>
        </div>

        <div className="sidebar-section-filter">
          <input
            type="text"
            className="form-input form-input-sm"
            placeholder="Search contacts"
            value={contactQuery}
            onChange={(e) => setContactQuery(e.target.value)}
            aria-label="Search contacts"
          />
        </div>

        <div className="right-contact-list">
          {contacts.length === 0 ? (
            <p className="text-sm text-muted" style={{ padding: '4px 8px' }}>You have no contacts yet.</p>
          ) : (
            contacts.map((c) => (
              <button
                type="button"
                key={c.id}
                className="right-contact-row"
                onClick={() => navigate(`/profile/${c.username}`)}
                aria-label={`View ${c.fullName}'s profile`}
              >
                <span className="right-contact-avatar">
                  <UserAvatar user={c} size="sm" />
                  {onlineUsers.has(c.id) && <span className="online-dot" aria-hidden="true" />}
                </span>
                <span className="right-contact-name ellipsis">{c.fullName}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  );
});
