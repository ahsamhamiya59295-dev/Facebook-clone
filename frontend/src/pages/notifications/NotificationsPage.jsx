import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthData } from '../../context/AuthContext.jsx';
import { notificationService } from '../../services';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
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

const TYPE_CLASS = {
  LIKE: 'like',
  COMMENT: 'comment',
  COMMENT_REPLY: 'comment',
  FRIEND_REQUEST: 'friend',
  FRIEND_ACCEPT: 'friend',
  FOLLOW: 'follow',
  MESSAGE: 'message',
  STORY: 'story',
  SYSTEM: 'system',
};

export default function NotificationsPage() {
  const { notifications, setNotifications, unreadNotifications, setUnreadNotifications } = useAuthData();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationService.all(1);
      setNotifications(data.notifications || []);
      setUnreadNotifications(data.unread || 0);
    } catch (err) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [setNotifications, setUnreadNotifications]);

  useEffect(() => {
    // The AuthProvider already loads notifications when the session starts, so
    // only fetch here when the context has nothing yet (e.g. a deep link).
    if (notifications.length > 0) {
      setLoading(false);
      return;
    }
    load();
  }, [load, notifications.length, setLoading]);

  const click = async (n) => {
    if (!n.isRead) {
      await notificationService.markRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadNotifications(Math.max(0, unreadNotifications - 1));
    }
    if (n.entityId) navigate(`/posts/${n.entityId}`);
    else if (n.actor) navigate(`/profile/${n.actor.username}`);
  };

  const markAll = async () => {
    await notificationService.markAllRead();
    setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnreadNotifications(0);
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="page-header">
        <h1>Notifications</h1>
        {notifications.some((n) => !n.isRead) && (
          <button className="btn btn-secondary btn-sm" onClick={markAll}>Mark all read</button>
        )}
      </div>
      <div className="card">
        {loading ? (
          <div className="loader-wrap"><div className="spinner" /></div>
        ) : notifications.length === 0 ? (
          <EmptyState icon="bell" title="No notifications yet" subtitle="Activity on your posts, friend requests and messages will show here." />
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={`notification-item ${n.isRead ? '' : 'unread'}`} onClick={() => click(n)} role="button" tabIndex={0}>
              {n.actor ? (
                <UserAvatar user={n.actor} size="lg" />
              ) : (
                <span className={`notification-icon ${TYPE_CLASS[n.type] || 'system'}`}>
                  <Icon name={TYPE_ICONS[n.type] || 'info'} />
                </span>
              )}
              <div className="notif-text">
                {n.actor?.fullName && <span className="text-bold">{n.actor.fullName} </span>}
                {n.message.replace(n.actor?.fullName || '', '').trim() || 'notified you'}
                <div className="text-xs text-muted">{timeAgo(n.createdAt)}</div>
              </div>
              {!n.isRead && <span className="dot" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--fb-blue)', flexShrink: 0 }} />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}