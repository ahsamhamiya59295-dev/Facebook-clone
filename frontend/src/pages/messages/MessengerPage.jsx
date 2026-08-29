import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { messageService } from '../../services';
import UserAvatar from '../../components/common/UserAvatar.jsx';
import Icon from '../../components/common/Icon.jsx';
import { formatTime, timeAgo } from '../../utils/format.js';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏'];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

export default function MessengerPage() {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const { error } = useToastActions();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customizeOpen, setCustomizeOpen] = useState(true);
  const [mediaOpen, setMediaOpen] = useState(true);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);
  const typingTimer = useRef(null);
  const lastEmitRef = useRef(0);

  const activeConv = conversations.find((c) => c.id === activeId);
  const otherUser = activeConv?.otherUser;

  const loadConversations = useCallback(async () => {
    try {
      const data = await messageService.conversations();
      setConversations(data.conversations || []);
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadMessages = useCallback(async (convId) => {
    setMsgLoading(true);
    try {
      const data = await messageService.messages(convId);
      setMessages(data.messages || []);
      await messageService.read(convId);
    } catch (err) {
      error(err.message);
    } finally {
      setMsgLoading(false);
    }
  }, [error]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  useEffect(() => {
    const el = chatRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = ({ message }) => {
      if (message.conversationId === activeId) {
        setMessages((prev) => [...prev, message]);
        socket.emit('read', { conversationId: activeId, recipientId: message.senderId });
      }
      loadConversations();
    };
    const onTyping = ({ userId, conversationId: cid }) => {
      if (cid === activeId && userId !== user.id) {
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
  }, [socket, activeId, user.id, loadConversations]);

  const selectConversation = (id) => {
    setActiveId(id);
    setShowEmojiPicker(false);
    setInputText('');
  };

  const goBack = () => {
    setActiveId(null);
    setMessages([]);
    setInputText('');
    setShowEmojiPicker(false);
  };

  const send = async (text, mediaUrl) => {
    if (!activeId) return;
    const content = text || inputText.trim();
    if (!content && !mediaUrl) return;
    const optimistic = {
      id: `temp-${Date.now()}`,
      content,
      mediaUrl: mediaUrl || null,
      createdAt: new Date().toISOString(),
      senderId: user.id,
      sender: { id: user.id, fullName: user.fullName, username: user.username },
    };
    setInputText('');
    setMessages((prev) => [...prev, optimistic]);
    try {
      await messageService.send(activeId, content, mediaUrl);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      error(err.message);
    }
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    send();
  };

  const handleSendThumb = () => send('👍');

  const handleTyping = (e) => {
    setInputText(e.target.value);
    if (otherUser && socket) {
      const now = Date.now();
      if (now - lastEmitRef.current >= 400) {
        lastEmitRef.current = now;
        socket.emit('typing', { conversationId: activeId, recipientId: otherUser.id });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredConvs = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title?.toLowerCase().includes(q) ||
      c.lastMessage?.content?.toLowerCase().includes(q)
    );
  });

  const showChat = isMobile ? activeId !== null : true;
  const showList = isMobile ? activeId === null : true;

  return (
    <div className="msg-root">
      {/* Column 1: Conversations List */}
      {showList && (
        <div className={`msg-left${isMobile ? ' msg-full-mobile' : ''}`}>
          <div className="msg-left-header">
            <h1 className="msg-left-title">Chats</h1>
            <div className="msg-left-actions">
              <button className="msg-icon-btn" title="Options">
                <Icon name="more" size={20} />
              </button>
              <button className="msg-icon-btn" title="New Message">
                <Icon name="edit" size={19} />
              </button>
            </div>
          </div>

          <div className="msg-search-wrap">
            <div className="msg-search-box">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Search Messenger"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="msg-conv-list">
            {loading ? (
              <div className="loader-wrap"><div className="spinner spinner-sm" /></div>
            ) : filteredConvs.length === 0 ? (
              <div className="msg-empty">
                <Icon name="messenger" size={48} />
                <p>No conversations found</p>
              </div>
            ) : (
              filteredConvs.map((c) => {
                const isSelected = c.id === activeId;
                const isUnread = c.unreadCount > 0;
                const isOnline = c.otherUser && onlineUsers.has(c.otherUser.id);
                const lastSenderIsMe = c.lastMessage?.senderId === user.id;
                return (
                  <div
                    key={c.id}
                    className={`msg-conv-item${isSelected ? ' active' : ''}${isUnread ? ' unread' : ''}`}
                    onClick={() => selectConversation(c.id)}
                  >
                    <div className="msg-conv-avatar">
                      <UserAvatar user={c.otherUser || { fullName: c.title }} size="lg" />
                      {isOnline && <span className="msg-online-dot" />}
                    </div>
                    <div className="msg-conv-info">
                      <h4 className={`msg-conv-name${isUnread ? ' bold' : ''}`}>
                        {c.title}
                      </h4>
                      <div className="msg-conv-preview">
                        <span className={`msg-conv-text${isUnread ? ' unread-text' : ''}`}>
                          {c.lastMessage
                            ? `${lastSenderIsMe ? 'You: ' : ''}${c.lastMessage.content || '📎'}`
                            : 'Say hi!'}
                        </span>
                        {c.lastMessage && (
                          <span className="msg-conv-time"> · {timeAgo(c.lastMessage.createdAt)}</span>
                        )}
                      </div>
                    </div>
                    {isUnread > 0 && (
                      <span className="msg-unread-badge">{c.unreadCount}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Column 2: Active Chat */}
      {showChat && (
        activeId && activeConv ? (
          <div className={`msg-center${isMobile ? ' msg-full-mobile' : ''}`}>
            {/* Chat Header */}
            <div className="msg-chat-header">
              <div className="msg-chat-header-left">
                {isMobile && (
                  <button className="msg-icon-btn msg-back-btn" onClick={goBack} title="Back">
                    <Icon name="back" size={22} />
                  </button>
                )}
                <div className="msg-chat-header-avatar">
                  <UserAvatar user={otherUser || {}} size="md" />
                  {otherUser && onlineUsers.has(otherUser.id) && <span className="msg-online-dot-sm" />}
                </div>
                <div>
                  <h3 className="msg-chat-header-name">{activeConv.title}</h3>
                  <span className="msg-chat-header-status">
                    {otherUser && onlineUsers.has(otherUser.id) ? 'Active now' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="msg-chat-header-actions">
                <button className="msg-icon-btn blue" title="Start voice call">
                  <Icon name="comment" size={20} />
                </button>
                <button className="msg-icon-btn blue" title="Start video call">
                  <Icon name="video" size={20} />
                </button>
                {!isMobile && (
                  <button
                    className={`msg-icon-btn${showRightPanel ? ' active-blue' : ''}`}
                    onClick={() => setShowRightPanel((p) => !p)}
                    title="Conversation information"
                  >
                    <Icon name="info" size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="msg-chat-messages" ref={chatRef}>
              <div className="msg-profile-intro">
                <div className="msg-profile-intro-avatar">
                  <UserAvatar user={otherUser || {}} size="xl" />
                  {otherUser && onlineUsers.has(otherUser.id) && <span className="msg-online-dot-lg" />}
                </div>
                <h2 className="msg-profile-intro-name">{activeConv.title}</h2>
                <p className="msg-profile-intro-sub">Active on Messenger</p>
                <p className="msg-profile-intro-sub">You're friends on Facebook</p>
              </div>

              {msgLoading ? (
                <div className="loader-wrap"><div className="spinner" /></div>
              ) : (
                messages.map((m) => {
                  const isMine = m.senderId === user.id;
                  const isEmojiOnly = m.content && /^[\p{Emoji_Presentation}\p{Emoji}\u200d\ufe0f\s]+$/u.test(m.content) && m.content.length <= 4;
                  return (
                    <div key={m.id} className={`msg-bubble-row${isMine ? ' mine' : ' theirs'}`}>
                      {!isMine && (
                        <div className="msg-bubble-avatar">
                          <UserAvatar user={m.sender || otherUser || {}} size="sm" />
                        </div>
                      )}
                      <div className="msg-bubble-wrap">
                        {m.mediaUrl ? (
                          <div className="msg-media-wrap">
                            {m.mediaType === 'VIDEO' ? (
                              <video src={m.mediaUrl} controls />
                            ) : (
                              <img src={m.mediaUrl} alt="attachment" loading="lazy" />
                            )}
                          </div>
                        ) : isEmojiOnly ? (
                          <span className="msg-emoji-only">{m.content}</span>
                        ) : (
                          <div className={`msg-bubble${isMine ? ' mine' : ' theirs'}`}>
                            {m.content}
                          </div>
                        )}
                        <div className={`msg-bubble-time${isMine ? ' right' : ''}`}>
                          {formatTime(m.createdAt)}
                          {isMine && <span className="msg-read-tick">✓✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {isTyping && (
                <div className="msg-bubble-row theirs">
                  <div className="msg-bubble-avatar">
                    <UserAvatar user={otherUser || {}} size="sm" />
                  </div>
                  <div className="msg-typing-bubble">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Emoji Picker */}
            {showEmojiPicker && (
              <div className="msg-emoji-bar">
                {QUICK_EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={() => { send(emoji); setShowEmojiPicker(false); }}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="msg-input-bar">
              <button className="msg-icon-btn blue" title="Attach photo">
                <Icon name="image" size={20} />
              </button>
              <button className="msg-icon-btn blue" onClick={() => setShowEmojiPicker((p) => !p)} title="Choose emoji">
                <Icon name="emoji" size={20} />
              </button>
              <form className="msg-input-form" onSubmit={handleSend}>
                <input
                  type="text"
                  placeholder="Aa"
                  value={inputText}
                  onChange={handleTyping}
                  onKeyDown={handleKeyDown}
                />
              </form>
              {inputText.trim() ? (
                <button className="msg-icon-btn blue" onClick={handleSend} title="Send">
                  <Icon name="send" size={20} />
                </button>
              ) : (
                <button className="msg-icon-btn blue" onClick={handleSendThumb} title="Send a Like">
                  <span className="msg-thumb-up">👍</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          !isMobile && (
            <div className="msg-center msg-empty-center">
              <div className="msg-empty-center-inner">
                <Icon name="messenger" size={80} />
                <h2>Your Messages</h2>
                <p>Send private photos and messages to a friend or group</p>
              </div>
            </div>
          )
        )
      )}

      {/* Column 3: Right Panel (desktop only) */}
      {!isMobile && showRightPanel && activeId && activeConv && (
        <div className="msg-right">
          <div className="msg-right-profile">
            <div className="msg-right-avatar">
              <UserAvatar user={otherUser || {}} size="xl" />
            </div>
            <h3 className="msg-right-name">{activeConv.title}</h3>
            <span className="msg-right-status">
              {otherUser && onlineUsers.has(otherUser.id) ? 'Active now' : 'Offline'}
            </span>
            <div className="msg-right-quick-actions">
              <div className="msg-quick-action">
                <div className="msg-quick-action-icon"><Icon name="comment" size={18} /></div>
                <span>Audio</span>
              </div>
              <div className="msg-quick-action">
                <div className="msg-quick-action-icon"><Icon name="video" size={18} /></div>
                <span>Video</span>
              </div>
              <div className="msg-quick-action">
                <div className="msg-quick-action-icon"><Icon name="bell" size={18} /></div>
                <span>Mute</span>
              </div>
              <div className="msg-quick-action">
                <div className="msg-quick-action-icon"><Icon name="search" size={18} /></div>
                <span>Search</span>
              </div>
            </div>
          </div>

          <div className="msg-right-accordions">
            <div className="msg-accordion">
              <button className="msg-accordion-header" onClick={() => setCustomizeOpen((p) => !p)}>
                <span>Customize chat</span>
                <Icon name={customizeOpen ? 'chevron_down' : 'chevron_right'} size={18} />
              </button>
              {customizeOpen && (
                <div className="msg-accordion-body">
                  <div className="msg-accordion-item">
                    <Icon name="sparkles" size={18} />
                    <span>Change theme</span>
                  </div>
                  <div className="msg-accordion-item">
                    <Icon name="emoji" size={18} />
                    <span>Change emoji</span>
                  </div>
                  <div className="msg-accordion-item">
                    <span className="msg-nickname-icon">Aa</span>
                    <span>Edit nicknames</span>
                  </div>
                </div>
              )}
            </div>

            <div className="msg-accordion">
              <button className="msg-accordion-header" onClick={() => setMediaOpen((p) => !p)}>
                <span>Media & files</span>
                <Icon name={mediaOpen ? 'chevron_down' : 'chevron_right'} size={18} />
              </button>
              {mediaOpen && (
                <div className="msg-accordion-body">
                  <div className="msg-accordion-item">
                    <Icon name="image" size={18} />
                    <span>Shared photos</span>
                  </div>
                  <div className="msg-accordion-item">
                    <Icon name="box" size={18} />
                    <span>Shared files</span>
                  </div>
                </div>
              )}
            </div>

            <div className="msg-accordion">
              <button className="msg-accordion-header" onClick={() => setPrivacyOpen((p) => !p)}>
                <span>Privacy & support</span>
                <Icon name={privacyOpen ? 'chevron_down' : 'chevron_right'} size={18} />
              </button>
              {privacyOpen && (
                <div className="msg-accordion-body">
                  <div className="msg-accordion-item">
                    <Icon name="shield" size={18} />
                    <span>Block {activeConv.title}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
