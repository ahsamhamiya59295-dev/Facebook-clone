import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { messageService, userService } from '../../services';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';

import { timeAgo } from '../../utils/format.js';

export default function MessagesPage() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const { error } = useToastActions();
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [conversations, setConversations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await messageService.conversations();
      setConversations(data.conversations || []);
      const friendsData = await userService.friends(user.id);
      setUsers(friendsData.friends || []);
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, error]);

  useEffect(() => { load(); }, [load]);

  const startChat = async (u) => {
    try {
      const data = await messageService.create(u.id);
      navigate(`/messages/${data.conversation.id}`);
      load();
    } catch (err) {
      error(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="messages-layout" style={{ height: 'auto', minHeight: 520 }}>
        <div className="conversation-list">
          <div className="chat-header">
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Chats</h2>
          </div>
          {loading ? (
            <div className="loader-wrap"><div className="spinner spinner-sm" /></div>
          ) : conversations.length === 0 ? (
            <div className="empty-state"><Icon name="messenger" /><p>No conversations yet</p></div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`conversation-item ${conversationId === c.id ? 'active' : ''}`}
                onClick={() => navigate(`/messages/${c.id}`)}
                role="button"
                tabIndex={0}
              >
                <span className="avatar-wrap">
                  <UserAvatar user={c.otherUser || { fullName: c.title }} size="lg" />
                  {c.otherUser && onlineUsers.has(c.otherUser.id) && <span className="online-dot" />}
                </span>
                <div className="conv-info">
                  <div className="conv-name ellipsis">{c.title}</div>
                  <div className="conv-last">
                    {c.lastMessage ? (
                      <>
                        {c.lastMessage.senderId === user.id && 'You: '}
                        {c.lastMessage.content || '📎'}
                      </>
                    ) : 'Say hi!'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {c.lastMessage && <span className="text-xs text-muted">{timeAgo(c.lastMessage.createdAt)}</span>}
                  {c.unreadCount > 0 && <span className="unread-badge">{c.unreadCount}</span>}
                </div>
              </div>
            ))
          )}

          {users.length > 0 && (
            <>
              <div className="dropdown-section-title" style={{ marginTop: 16 }}>Start a chat</div>
              {users.map((u) => (
                <div key={u.id} className="conversation-item" onClick={() => startChat(u)} role="button" tabIndex={0}>
                  <span className="avatar-wrap">
                    <UserAvatar user={u} size="md" />
                    {onlineUsers.has(u.id) && <span className="online-dot" />}
                  </span>
                  <div className="conv-info"><div className="conv-name ellipsis">{u.fullName}</div></div>
                  <Icon name="plus" size={18} />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}