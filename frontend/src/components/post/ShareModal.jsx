import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import Modal from '../common/Modal.jsx';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import { postService, messageService } from '../../services';

export default function ShareModal({ post, onClose, onShared, onCopyLink }) {
  const { apiError } = useAuth();
  const { success, error } = useToastActions();
  const navigate = useNavigate();
  const [tab, setTab] = useState('share');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [sendingTo, setSendingTo] = useState(null);
  const textRef = useRef(null);

  useEffect(() => {
    textRef.current?.focus();
  }, [tab]);

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const data = await messageService.conversations();
      if (data.success === false) return;
      setConversations(data.conversations || []);
    } catch (err) {
      // ignore
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const shareToFeed = async () => {
    setSaving(true);
    try {
      await postService.share(post.id, message.trim());
      success('Post shared to your feed');
      onShared?.();
    } catch (err) {
      error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const sendInMessenger = async (conv) => {
    setSendingTo(conv.id);
    try {
      const link = `${window.location.origin}/posts/${post.id}`;
      const text = message.trim()
        ? `${message.trim()}\n${link}`
        : `Shared a post: ${link}`;
      await messageService.send(conv.id, text);
      success(`Shared with ${conv.otherUser?.fullName || 'your chat'}`);
      onClose?.();
    } catch (err) {
      error(apiError(err));
    } finally {
      setSendingTo(null);
    }
  };

  const filteredConvs = conversations.filter((c) =>
    (c.otherUser?.fullName || c.title || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal title="Share" onClose={onClose} maxWidth={500}>
      <div className="share-modal">
        <div className="share-modal-preview">
          <UserAvatar user={post.author} size="md" />
          <div style={{ minWidth: 0 }}>
            <div className="text-bold">{post.author.fullName}</div>
            <div className="text-sm text-muted ellipsis">{post.content || 'Shared media'}</div>
          </div>
          {post.media?.[0] && (
            <img className="share-thumb" src={post.media[0].url} alt="" loading="lazy" />
          )}
        </div>

        <div className="share-tabs" role="tablist" aria-label="Share options">
          {[
            { key: 'share', label: 'Share Now', icon: 'share' },
            { key: 'message', label: 'Send in Messenger', icon: 'messenger' },
            { key: 'copy', label: 'Copy Link', icon: 'link' },
          ].map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`share-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => {
                if (t.key === 'message' && conversations.length === 0) loadConversations();
                setTab(t.key);
              }}
            >
              <Icon name={t.icon} size={18} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {tab === 'share' && (
          <div className="share-pane">
            <textarea
              ref={textRef}
              className="form-textarea"
              rows={3}
              placeholder={`Say something about this...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="share-pane-actions">
              <button className="btn btn-primary" onClick={shareToFeed} disabled={saving}>
                {saving ? 'Sharing...' : 'Post'}
              </button>
            </div>
          </div>
        )}

        {tab === 'message' && (
          <div className="share-pane">
            <div className="share-conv-search">
              <Icon name="search" size={16} />
              <input
                className="comment-input"
                placeholder="Search people and chats..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search chats"
              />
            </div>
            <div className="share-conv-list">
              {loadingConvs ? (
                <div className="loader-wrap" style={{ padding: 16 }}>
                  <div className="spinner spinner-sm" />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="empty-mini">
                  {search ? 'No matching chats' : 'No active chats yet'}
                </div>
              ) : (
                filteredConvs.map((c) => (
                  <button
                    key={c.id}
                    className="share-conv-row"
                    onClick={() => sendInMessenger(c)}
                    disabled={sendingTo === c.id}
                  >
                    <UserAvatar
                      src={c.otherUser?.profile?.avatarUrl}
                      name={c.otherUser?.fullName || c.title}
                      size={36}
                    />
                    <span className="flex-grow ellipsis" style={{ textAlign: 'left' }}>
                      {c.otherUser?.fullName || c.title}
                    </span>
                    <span className="text-link" role="button" tabIndex={0}>
                      {sendingTo === c.id ? 'Sending...' : 'Send'}
                    </span>
                  </button>
                ))
              )}
              {!loadingConvs && conversations.length === 0 && (
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/messages')}>
                  Open Messenger
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'copy' && (
          <div className="share-pane">
            <div className="share-link-row">
              <input
                className="comment-input"
                readOnly
                value={`${window.location.origin}/posts/${post.id}`}
                onFocus={(e) => e.target.select()}
                aria-label="Post link"
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (onCopyLink) onCopyLink();
                  else navigator.clipboard?.writeText(`${window.location.origin}/posts/${post.id}`);
                  onClose?.();
                }}
              >
                Copy
              </button>
            </div>
            <div className="text-sm text-muted" style={{ marginTop: 8 }}>
              Anyone who can see this post can follow the link.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}