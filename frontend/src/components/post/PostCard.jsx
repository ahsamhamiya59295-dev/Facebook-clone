import { useState, useEffect, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { postService, safetyService, messageService } from '../../services';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import Dropdown from '../common/Dropdown.jsx';
import Modal from '../common/Modal.jsx';
import ReactionButton from '../reactions/ReactionButton.jsx';
import { ReactionIcon } from '../reactions/ReactionIcons.jsx';
import CommentSection from '../comments/CommentSection.jsx';
import ShareModal from './ShareModal.jsx';
import { REACTIONS, PRIVACY_ICON } from '../../constants';
import { timeAgo, pluralize, formatFullDate } from '../../utils/format.js';

function PostMedia({ post }) {
  const media = post.media || [];
  if (media.length === 0) return null;

  if (media.length === 1) {
    const m = media[0];
    return (
      <div className="post-media">
        {m.mediaType === 'VIDEO' ? (
          <video src={m.url} controls preload="metadata" />
        ) : (
          <img src={m.url} alt={post.content || 'Post media'} loading="lazy" decoding="async" fetchPriority="low" />
        )}
      </div>
    );
  }

  const cols = media.length === 2 || media.length === 4 ? 2 : 3;
  return (
    <div className="post-media-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, maxHeight: media.length > 1 ? 400 : undefined }}>
      {media.slice(0, 4).map((m, i) =>
        m.mediaType === 'VIDEO' ? (
          <video key={i} src={m.url} controls preload="metadata" style={{ height: '100%' }} />
        ) : (
          <img key={i} src={m.url} alt={`Post media ${i + 1}`} loading="lazy" decoding="async" fetchPriority="low" style={{ height: media.length > 1 ? 200 : undefined, objectFit: 'cover' }} />
        ),
      )}
    </div>
  );
}

function PostCard({ post: initialPost, onPostUpdate, onPostDelete }) {
  const { user, apiError } = useAuth();
  const { success, error } = useToastActions();
  const navigate = useNavigate();
  const [post, setPost] = useState(initialPost);
  const [myReaction, setMyReaction] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setPost(initialPost);
    setMyReaction(initialPost?.myReaction || null);
  }, [initialPost]);

  const isMine = post?.author?.id === user?.id;
  const contentLong = (post?.content?.length || 0) > 320;

  const reactionTotal = post?._count?.reactions || (post?.reactionSummary?.total) || 0;

  const syncFromServer = (data) => {
    setPost((p) => ({
      ...p,
      _count: { ...(p._count || {}), reactions: data.summary?.total ?? p._count?.reactions },
      reactionSummary: data.summary,
    }));
  };

  const handleReaction = async (type) => {
    const prev = myReaction;
    const wasActive = !!prev;
    setMyReaction(type);
    setPost((p) => ({
      ...p,
      _count: { ...(p._count || {}), reactions: Math.max(0, (p._count?.reactions || 0) + (wasActive ? 0 : 1)) },
    }));
    try {
      const data = await postService.react(post.id, type);
      setMyReaction(data.active ? data.reaction?.type : null);
      syncFromServer(data);
      onPostUpdate?.(data);
    } catch (err) {
      setMyReaction(prev);
      setPost((p) => ({
        ...p,
        _count: { ...(p._count || {}), reactions: Math.max(0, (p._count?.reactions || 0) - (wasActive ? 0 : 1)) },
      }));
      error(apiError(err));
    }
  };

  const removeReaction = async () => {
    const prev = myReaction;
    setMyReaction(null);
    setPost((p) => ({
      ...p,
      _count: { ...(p._count || {}), reactions: Math.max(0, (p._count?.reactions || 0) - 1) },
    }));
    try {
      const data = await postService.unreact(post.id);
      syncFromServer(data);
    } catch (err) {
      setMyReaction(prev);
      setPost((p) => ({
        ...p,
        _count: { ...(p._count || {}), reactions: (p._count?.reactions || 0) + 1 },
      }));
      error(apiError(err));
    }
  };

  const savePost = async () => {
    try {
      const data = await postService.save(post.id, null);
      success(data.saved ? 'Post saved' : 'Post removed from saved');
    } catch (err) {
      error(apiError(err));
    }
  };

  const deletePost = async () => {
    try {
      await postService.remove(post.id);
      success('Post deleted');
      onPostDelete?.(post);
    } catch (err) {
      error(apiError(err));
    }
  };

  const editPost = async () => {
    setSaving(true);
    try {
      const data = await postService.update(post.id, { content: editContent });
      setPost(data.post);
      setEditing(false);
      success('Post updated');
    } catch (err) {
      error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const reportPost = async () => {
    try {
      await safetyService.report({ targetType: 'POST', targetId: post.id, reason: 'Inappropriate content' });
      success('Post reported');
    } catch (err) {
      error(apiError(err));
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/posts/${post.id}`);
      success('Link copied');
    } catch (err) {
      error('Could not copy link');
    }
  };

  const messageAuthor = async () => {
    try {
      const data = await messageService.create(post.author.id);
      navigate(`/messages/${data.conversation.id}`);
    } catch (err) {
      error(apiError(err));
    }
  };

  const handleShared = () => {
    setShowShare(false);
    setPost((p) => ({ ...p, _count: { ...(p._count || {}), shares: (p._count?.shares || 0) + 1 } }));
  };

  return (
    <article className="post-card" aria-label="Post">
      <div className="post-head">
        <UserAvatar user={post.author} size="md" />
        <div className="flex-grow" style={{ marginLeft: 0 }}>
          <Link to={`/profile/${post.author.username}`} className="post-author-name">
            {post.author.fullName}
            {post.author.isVerified && <Icon name="verified" size={14} style={{ fill: 'var(--fb-blue)', marginLeft: 4, verticalAlign: 'middle' }} />}
          </Link>
          <div className="post-time">
            <span title={formatFullDate(post.createdAt)}>{timeAgo(post.createdAt)}</span>
            {post.isEdited && <span> · Edited</span>}
            <Icon name={PRIVACY_ICON[post.privacy] || 'globe'} className="privacy-icon" />
          </div>
        </div>

        <Dropdown
          trigger={<button className="icon-btn" aria-label="Post options"><Icon name="more" /></button>}
        >
          {({ close }) => (
            <div role="menu">
              {isMine && (
                <>
                  <div className="dropdown-item" onClick={() => { close(); setEditing(true); setEditContent(post.content || ''); }}>
                    <Icon name="edit" />
                    <span>Edit Post</span>
                  </div>
                  <div className="dropdown-item" onClick={() => { close(); setConfirmDelete(true); }}>
                    <Icon name="trash" />
                    <span>Delete Post</span>
                  </div>
                </>
              )}
              <div className="dropdown-item" onClick={() => { close(); savePost(); }}>
                <Icon name="bookmark" />
                <span>{'Save Post'}</span>
              </div>
              <div className="dropdown-item" onClick={() => { close(); setShowShare(true); }}>
                <Icon name="share" />
                <span>Share Post</span>
              </div>
              {!isMine && (
                <>
                  <div className="dropdown-item" onClick={() => { close(); messageAuthor(); }}>
                    <Icon name="messenger" />
                    <span>Message</span>
                  </div>
                  <div className="dropdown-divider" />
                  <div className="dropdown-item danger" onClick={() => { close(); reportPost(); }}>
                    <Icon name="report" />
                    <span>Report Post</span>
                  </div>
                </>
              )}
              <div className="dropdown-divider" />
              <div className="dropdown-item" onClick={() => { close(); copyLink(); }}>
                <Icon name="link" />
                <span>Copy Link</span>
              </div>
            </div>
          )}
        </Dropdown>
      </div>

      {showShare && <ShareModal post={post} onClose={() => setShowShare(false)} onShared={handleShared} onCopyLink={copyLink} />}

      {confirmDelete && (
        <Modal
          title="Delete post?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { setConfirmDelete(false); deletePost(); }}>Delete</button>
            </>
          }
        >
          <p>This post will be permanently deleted. This can&apos;t be undone.</p>
        </Modal>
      )}

      {editing ? (
        <div className="post-content" style={{ padding: '0 16px 12px' }}>
          <textarea
            className="form-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={editPost} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {post.content && (
            <div className={`post-content ${contentLong && !expanded ? 'collapsed' : ''}`}>
              {post.content}
              {contentLong && (
                <div className="text-link" onClick={() => setExpanded((e) => !e)}>
                  {expanded ? 'See less' : 'See more'}
                </div>
              )}
            </div>
          )}

          <PostMedia post={post} />

          <div className="post-stats">
            <span className="reaction-icons">
              {reactionTotal > 0 && (
                <>
                  {REACTIONS.filter((r) => post.reactionSummary?.counts?.[r.type]).map((r) => (
                    <span key={r.type} className="reaction-icon" title={r.label}>
                      <ReactionIcon type={r.type} size={20} />
                    </span>
                  ))}
                  <span style={{ marginLeft: 6 }}>{pluralize(reactionTotal, 'reaction')}</span>
                </>
              )}
            </span>
            <span>
              <span className="text-link">{pluralize(post._count?.comments || 0, 'comment')}</span>
              {' · '}
              <span className="text-link">{pluralize(post._count?.shares || 0, 'share')}</span>
            </span>
          </div>

          <div className="post-actions">
            <ReactionButton
              activeReaction={myReaction}
              onReact={handleReaction}
              onClear={removeReaction}
            />
            <button className="post-action" onClick={() => setCommentsOpen((c) => !c)}>
              <Icon name="comment" />
              Comment
            </button>
            <button className="post-action" onClick={() => setShowShare(true)}>
              <Icon name="share" />
              Share
            </button>
          </div>

          {commentsOpen && !editing && <CommentSection post={post} onPostUpdate={onPostUpdate} />}
        </>
      )}
    </article>
  );
}

export default memo(PostCard);