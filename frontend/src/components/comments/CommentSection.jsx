import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { postService } from '../../services';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import Modal from '../common/Modal.jsx';
import { REACTIONS } from '../../constants';
import { ReactionIcon } from '../reactions/ReactionIcons.jsx';
import { timeAgo } from '../../utils/format.js';

function CommentRow({ comment, post, onDeleted, onReply }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [replies, setReplies] = useState([]);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [myReaction, setMyReaction] = useState(comment.myReaction || null);
  const [count, setCount] = useState(comment._count?.reactions || 0);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [showReact, setShowReact] = useState(false);

  const isMine = comment.user?.id === user?.id;
  const isAuthor = post?.author?.id === user?.id;

  const react = async (type) => {
    try {
      const data = await postService.reactComment(comment.id, type);
      setMyReaction(data.active ? type : null);
      setCount((c) => (data.active ? (myReaction === type ? c : c + 1) : Math.max(0, c - 1)));
      setShowReact(false);
    } catch (err) {
      // ignore
    }
  };

  const edit = async () => {
    try {
      const data = await postService.updateComment(comment.id, editText);
      comment.content = data.comment?.content ?? data.comment ?? editText;
      comment.isEdited = true;
      setEditing(false);
    } catch (err) {
      // ignore
    }
  };

  const remove = async () => {
    try {
      await postService.deleteComment(comment.id);
      setConfirmDelete(false);
      onDeleted?.(comment.id);
    } catch (err) {
      // ignore
    }
  };

  const loadReplies = useCallback(async () => {
    try {
      const data = await postService.replies(comment.id);
      setReplies((prev) => [...prev, ...data.replies]);
      setRepliesOpen(true);
    } catch (err) {
      // ignore
    }
  }, [comment.id]);

  return (
    <div className="comment-item" style={{ flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <UserAvatar user={comment.user} size="sm" />
        <div style={{ flex: 1 }}>
          <div className="comment-bubble">
            <div className="comment-author" onClick={() => navigate(`/profile/${comment.user.username}`)} style={{ cursor: 'pointer' }}>
              {comment.user.fullName}
            </div>
            {editing ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="comment-input"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') edit(); }}
                  autoFocus
                />
                <button className="btn btn-sm btn-primary" onClick={edit}>Save</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            ) : (
              <>
                <div className="comment-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{comment.content}</div>
                {comment.isEdited && <div className="comment-edited">Edited</div>}
              </>
            )}
          </div>
          <div className="comment-actions-row">
            <span>{timeAgo(comment.createdAt)}</span>
            <button onClick={() => setShowReact((s) => !s)}>
              {myReaction ? <ReactionIcon type={myReaction} size={16} /> : 'Like'}
            </button>
            {count > 0 && <span>{count}</span>}
            <button onClick={() => onReply?.(comment)}>Reply</button>
            {comment._count?.replies > 0 && (
              <button onClick={loadReplies}>{comment._count.replies} replies</button>
            )}
            {(isMine || isAuthor) && (
              <button onClick={() => setConfirmDelete(true)}>Delete</button>
            )}
            {isMine && <button onClick={() => setEditing(true)}>Edit</button>}
            {showReact && (
              <span className="react-popover">
                {REACTIONS.map((r) => (
                  <span
                    key={r.type}
                    role="button"
                    tabIndex={0}
                    className="reaction-emoji"
                    title={r.label}
                    onClick={() => react(r.type)}
                  >
                    <ReactionIcon type={r.type} size={24} />
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      </div>
      {repliesOpen && replies.length > 0 && (
        <div className="comment-replies">
          {replies.map((r) => <CommentRow key={r.id} comment={r} post={post} onDeleted={onDeleted} />)}
        </div>
      )}

      {confirmDelete && (
        <Modal
          title="Delete comment?"
          onClose={() => setConfirmDelete(false)}
          maxWidth={420}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={remove}>Delete</button>
            </div>
          }
        >
          <p>This comment will be permanently deleted. This can&apos;t be undone.</p>
        </Modal>
      )}
    </div>
  );
}

export default function CommentSection({ post, onPostUpdate }) {
  const { user, apiError } = useAuth();
  const { error } = useToastActions();
  const [comments, setComments] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [, setTotal] = useState(0);
  const [newText, setNewText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await postService.comments(post.id, p);
      setComments((prev) => (p === 1 ? data.comments : [...prev, ...data.comments]));
      setHasMore(data.hasMore);
      setTotal(data.total);
      setPage(p);
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [post.id]);

  useEffect(() => {
    setComments([]);
    setPage(1);
    setReplyTo(null);
    load(1);
  }, [post.id, load]);

  const submit = async () => {
    if (!newText.trim()) return;
    const text = newText.trim();
    if (replyTo) {
      try {
        await postService.addComment(post.id, text, replyTo.id);
        setReplyTo(null);
        setNewText('');
        await load(page);
        onPostUpdate?.();
      } catch (err) {
        error(apiError(err));
      }
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      content: text,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        profile: user.profile,
      },
      createdAt: new Date().toISOString(),
      isEdited: false,
      _count: { reactions: 0, replies: 0 },
    };
    setComments((prev) => [...prev, optimistic]);
    setNewText('');
    setTotal((t) => t + 1);
    try {
      const data = await postService.addComment(post.id, text, null);
      setComments((prev) => prev.map((c) => (c.id === tempId ? data.comment : c)));
      onPostUpdate?.();
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setTotal((t) => Math.max(0, t - 1));
      error(apiError(err));
    }
  };

  const handleDeleted = (id) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  };

  return (
    <div className="comments-section">
      <div className="form-group" style={{ margin: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <UserAvatar user={user} size="sm" />
          <div style={{ flex: 1 }}>
            <div className="comment-input-row">
              <input
                className="comment-input"
                placeholder={replyTo ? `Reply to ${replyTo.user?.fullName}...` : 'Write a comment...'}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                aria-label="Comment"
                autoFocus
              />
              <button className="btn btn-sm btn-primary" onClick={submit} disabled={!newText.trim()} aria-label="Post comment">
                <Icon name="send" size={14} />
              </button>
            </div>
            {replyTo && (
              <div className="reply-target">
                Replying to {replyTo.user?.fullName}
                <span className="text-link" onClick={() => setReplyTo(null)}> (cancel)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="comments-list">
        {loading ? (
          <div className="loader-wrap" style={{ padding: 12 }}>
            <div className="spinner spinner-sm" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted" style={{ padding: '8px 0' }}>No comments yet.</p>
        ) : (
          comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              post={post}
              onDeleted={handleDeleted}
              onReply={setReplyTo}
            />
          ))
        )}
        {hasMore && (
          <button className="comment-load-more" onClick={() => load(page + 1)}>View more comments</button>
        )}
      </div>
    </div>
  );
}