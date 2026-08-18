import { useEffect, memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UserAvatar from '../common/UserAvatar';
import { formatTimeAgo, mediaUrl } from '../../utils/helpers';

function ConversationList({ conversations, onlineUsers, onSelect, autoSelect = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeId = location.pathname.split('/')[2];

  useEffect(() => {
    if (autoSelect && conversations.length > 0 && !activeId) {
      const initial = conversations[0];
      if (onSelect) onSelect(initial);
      else navigate(`/messages/${initial.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  const goTo = (c) => {
    if (onSelect) onSelect(c);
    else navigate(`/messages/${c.id}`);
  };

  return (
    <div className="conversation-list">
      {conversations.map((c) => (
        <button
          key={c.id}
          className={`conversation-item ${c.id === activeId ? 'active' : ''}`}
          onClick={() => goTo(c)}
        >
          <UserAvatar
            src={c.otherUser ? mediaUrl(c.otherUser.profile?.avatarUrl) : null}
            name={c.otherUser?.fullName || c.title}
            size={44}
            online={c.otherUser ? onlineUsers.has(c.otherUser.id) : false}
          />
          <div className="conversation-info">
            <strong className="conversation-name">{c.otherUser?.fullName || c.title}</strong>
            <span className={`conversation-preview ${c.unreadCount > 0 ? 'unread' : ''}`}>
              {c.lastMessage?.content || 'Say hi! 👋'}
            </span>
          </div>
          <div className="conversation-meta">
            {c.lastMessage && <span className="conversation-time">{formatTimeAgo(c.lastMessage.createdAt)}</span>}
            {c.unreadCount > 0 && <span className="unread-badge">{c.unreadCount}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

export default memo(ConversationList);