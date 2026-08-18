import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { messageService } from '../../services';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';
import { formatTime } from '../../utils/format.js';

export default function ConversationPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const { error } = useToastActions();
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef(null);
  const typingTimer = useRef(null);
  const chatRef = useRef(null);
  const lastEmitRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await messageService.messages(conversationId);
      setMessages(data.messages || []);
      const conv = await messageService.conversations();
      const found = conv.conversations.find((c) => c.id === conversationId);
      if (found) {
        setTitle(found.title);
        setOtherUser(found.otherUser);
      }
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  }, [conversationId, error]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Only auto-scroll when the reader is already near the bottom so reading
    // older history is never interrupted; instant scroll keeps rapid sends smooth.
    const el = chatRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      endRef.current?.scrollIntoView();
    }
  }, [messages]);

  useEffect(() => {
    if (!socket) return undefined;
    const onMessage = ({ message }) => {
      if (message.conversationId === conversationId) {
        setMessages((prev) => [...prev, message]);
        socket.emit('read', { conversationId, recipientId: message.senderId });
      }
    };
    const onTyping = ({ userId, conversationId: cid }) => {
      if (cid === conversationId && userId !== user.id) {
        setIsTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setIsTyping(false), 2000);
      }
    };
    socket.on('message:new', onMessage);
    socket.on('typing', onTyping);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('typing', onTyping);
      clearTimeout(typingTimer.current);
    };
  }, [socket, conversationId, user.id]);

  const send = async () => {
    if (!content.trim()) return;
    const optimistic = {
      id: `temp-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      senderId: user.id,
      sender: { id: user.id, fullName: user.fullName, username: user.username },
    };
    setContent('');
    setMessages((prev) => [...prev, optimistic]);
    try {
      await messageService.send(conversationId, content);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      error(err.message);
    }
  };

  const handleTyping = (e) => {
    setContent(e.target.value);
    if (otherUser) {
      // Throttle typing presence to at most one emit per 400ms per burst.
      const now = Date.now();
      if (now - lastEmitRef.current >= 400) {
        lastEmitRef.current = now;
        socket?.emit('typing', { conversationId, recipientId: otherUser.id });
      }
    }
  };

  return (
    <div className="messages-layout">
      <div className="conversation-list messages-back-col" style={{ borderRight: 'none' }}>
        <button className="chat-header" onClick={() => navigate('/messages')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none' }}>
          <Icon name="back" size={20} />
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Back</h2>
        </button>
      </div>
      <div className="messages-mobile-back">
        <button className="chat-header" onClick={() => navigate('/messages')} aria-label="Back to chats">
          <Icon name="back" size={20} />
          <span className="text-bold">Chats</span>
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="chat-header">
          <span className="avatar-wrap">
            <UserAvatar user={otherUser || { fullName: title }} size="lg" />
            {otherUser && onlineUsers.has(otherUser.id) && <span className="online-dot" />}
          </span>
          <div>
            <div className="text-bold">{title}</div>
            <div className="text-xs text-muted">
              {otherUser && onlineUsers.has(otherUser.id) ? 'Active now' : formatTime(new Date())}
            </div>
          </div>
        </div>

        <div className="chat-messages" ref={chatRef}>
          {loading ? (
            <div className="loader-wrap"><div className="spinner" /></div>
          ) : messages.length === 0 ? (
            <div className="empty-state"><Icon name="messenger" /><p>Say hi to start the conversation</p></div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === user.id;
              return (
                <div key={m.id} className={`message-row ${mine ? 'mine' : 'theirs'}`}>
                  <div className={`message-bubble ${mine ? 'mine' : 'theirs'}`}>
                    {m.content}
                    {m.mediaUrl && (m.mediaType === 'VIDEO' ? (
                      <video src={m.mediaUrl} controls style={{ maxWidth: 240, borderRadius: 8, marginTop: 4 }} />
                    ) : (
                      <img src={m.mediaUrl} alt="" loading="lazy" decoding="async" style={{ maxWidth: 240, borderRadius: 8, marginTop: 4 }} />
                    ))}
                    <div className="message-time">{formatTime(m.createdAt)}</div>
                    {mine && m.readBy?.length > 0 && <span className="text-xs" style={{ color: '#9ecbff' }}>✓✓</span>}
                  </div>
                </div>
              );
            })
          )}
          {isTyping && (
            <div className="message-row theirs">
              <div className="message-typing"><span /><span /><span /></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="chat-input">
          <button className="icon-btn" aria-label="Add photo"><Icon name="image" /></button>
          <div className="chat-input-box">
            <input
              placeholder="Type a message..."
              value={content}
              onChange={handleTyping}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              aria-label="Message"
            />
          </div>
          {content.trim() && (
            <button className="icon-btn" style={{ background: 'var(--fb-blue)', color: '#fff' }} onClick={send} aria-label="Send">
              <Icon name="send" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}