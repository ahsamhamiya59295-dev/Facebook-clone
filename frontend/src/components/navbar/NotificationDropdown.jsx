import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthData } from '../../context/AuthContext.jsx';
import { notificationService } from '../../services';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import { timeAgo } from '../../utils/format.js';

const TYPE_ICONS = {
  LIKE: 'like',
  COMMENT: 'comment',
  COMMENT_REPLY: 'comment',
  FRIEND_REQUEST: 'friends',
  FRIEND_ACCEPT: 'check',
  FOLLOW: 'follow',
  MESSAGE: 'messenger',
  STORY: 'story',
  SHARE: 'share',
  GROUP: 'group',
  EVENT: 'calendar',
  SYSTEM: 'info',
};

const TYPE_TINT = {
  LIKE: '#0866ff',
  COMMENT: '#3a8df5',
  COMMENT_REPLY: '#3a8df5',
  FRIEND_REQUEST: '#0866ff',
  FRIEND_ACCEPT: '#0866ff',
  FOLLOW: '#0866ff',
  MESSAGE: '#0866ff',
  STORY: '#7a3cf2',
  SHARE: '#45bd62',
  GROUP: '#0866ff',
  EVENT: '#fa3e3e',
  SYSTEM: '#65676b',
};

export default memo(function NotificationDropdown({ onClose }) {
  const { notifications, setNotifications, unreadNotifications, setUnreadNotifications } = useAuthData();
  const navigate = useNavigate();

  const handleClick = async (n) => {
    if (!n.isRead) {
      try { await notificationService.markRead(n.id); } catch (err) { /* ignore */ }
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadNotifications(Math.max(0, unreadNotifications - 1));
    }
    onClose?.();
    if (n.type === 'FRIEND_REQUEST') {
      navigate('/friends/requests');
    } else if (n.entityId) {
      navigate(`/posts/${n.entityId}`);
    } else if (n.actor?.username) {
      navigate(`/profile/${n.actor.username}`);
    }
  };

  const markAll = async () => {
    try { await notificationService.markAllRead(); } catch (err) { /* ignore */ }
    setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnreadNotifications(0);
  };

  const visible = notifications.slice(0, 8);

  return (
    <div className="dropdown-menu notif-menu anim-pop-in" role="menu" aria-label="Notifications">
      <div className="notif-menu-header">
        <h4 className="notif-menu-title">Notifications</h4>
        {notifications.some((n) => !n.isRead) && (
          <button type="button" className="notif-menu-link" onClick={markAll}>
            Mark all as read
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="notif-empty">
          <Icon name="bell" size={28} />
          <p>No notifications yet</p>
        </div>
      ) : (
        <ul className="notif-list">
          {visible.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={`notif-row${n.isRead ? '' : ' unread'}`}
                onClick={() => handleClick(n)}
              >
                {n.actor ? (
                  <UserAvatar user={n.actor} size="md" />
                ) : (
                  <span
                    className="notif-row-icon"
                    style={{ background: TYPE_TINT[n.type] || '#65676b' }}
                  >
                    <Icon name={TYPE_ICONS[n.type] || 'info'} size={20} />
                  </span>
                )}
                <span className="notif-row-text">
                  <span className="notif-row-author">{n.actor?.fullName || 'Someone'}</span>
                  <span className="notif-row-message">
                    {' '}
                    {(n.message || '').replace(n.actor?.fullName || '', '').trim() || 'updated you'}
                  </span>
                  <span className="notif-row-time">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.isRead && <span className="notif-row-dot" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="notif-menu-footer">
        <button
          type="button"
          className="notif-menu-link"
          onClick={() => { onClose?.(); navigate('/notifications'); }}
        >
          See all
        </button>
      </div>
    </div>
  );
});
