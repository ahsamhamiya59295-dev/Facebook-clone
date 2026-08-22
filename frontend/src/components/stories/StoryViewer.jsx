import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { storyService } from '../../services';
import { mediaUrl } from '../../utils/helpers.js';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import Modal from '../common/Modal.jsx';

function storyTimeAgo(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function StoryViewer({ group, total, onClose, onNext, onPrev }) {
  const { user } = useAuth();
  const { success, error } = useToastActions();
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const rafRef = useRef(null);
  const storyIndexRef = useRef(0);
  const progressRef = useRef(0);
  const pauseTimerRef = useRef(null);
  const replyInputRef = useRef(null);
  const DURATION = 5000;

  const story = group.stories[storyIndex];
  const storyUrl = mediaUrl(story?.url);

  useEffect(() => {
    storyIndexRef.current = storyIndex;
  }, [storyIndex]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const markViewed = useCallback(async () => {
    if (!story || story.views?.some((v) => v.viewerId === user.id)) return;
    try {
      await storyService.view(story.id);
    } catch {
      // ignore
    }
  }, [story, user.id]);

  useEffect(() => {
    markViewed();
  }, [markViewed]);

  useEffect(() => {
    if (!story || paused) return undefined;
    setProgress(0);
    const start = Date.now();
    const offset = (progressRef.current / 100) * DURATION;
    const adjustedStart = start - offset;
    const tick = () => {
      const elapsed = Date.now() - adjustedStart;
      const p = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(p);
      progressRef.current = p;
      if (elapsed >= DURATION) {
        if (storyIndexRef.current + 1 < group.stories.length) {
          setStoryIndex((i) => i + 1);
        } else {
          onNext?.();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [story, story?.id, group.stories.length, onNext, paused]);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const handlePointerDown = useCallback(() => {
    pauseTimerRef.current = setTimeout(() => {
      setPaused(true);
    }, 200);
  }, []);

  const handlePointerUp = useCallback(() => {
    clearTimeout(pauseTimerRef.current);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (storyIndex > 0) {
          setStoryIndex((i) => i - 1);
        } else {
          onPrev?.();
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (storyIndex + 1 < group.stories.length) {
          setStoryIndex((i) => i + 1);
        } else {
          onNext?.();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext, storyIndex, group.stories.length, togglePause]);

  const loadViewers = async () => {
    setViewersOpen((o) => !o);
    if (!viewersOpen) {
      try {
        const data = await storyService.viewers(story.id);
        setViewers(data.views || []);
      } catch {
        // ignore
      }
    }
  };

  const deleteStory = async () => {
    setDeleting(true);
    try {
      await storyService.remove(story.id);
      success('Story deleted');
      onClose();
    } catch {
      error('Failed to delete story');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const sendReply = () => {
    if (!replyText.trim()) return;
    setReplyText('');
  };

  if (!story) return null;

  const bgUrl = storyUrl;

  return (
    <div className="sv-backdrop" role="dialog" aria-modal="true">
      {bgUrl && <div className="sv-bg" style={{ backgroundImage: `url(${bgUrl})` }} />}

      <div className="sv-container">
        <div className="sv-story-column">
          <div
            className="sv-story-card"
            onClick={togglePause}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {story.mediaType === 'VIDEO' ? (
              <video
                src={story.url}
                className="sv-media"
                autoPlay
                muted
                loop={false}
                playsInline
                preload="metadata"
              />
            ) : (
              <img src={story.url} alt="" className="sv-media" decoding="async" />
            )}

            <div className="sv-progress-track">
              {group.stories.map((s, i) => (
                <div key={s.id} className="sv-progress-segment">
                  <div className="sv-progress-bg" />
                  <div
                    className="sv-progress-fill"
                    style={{
                      transform: i < storyIndex
                        ? 'scaleX(1)'
                        : i === storyIndex
                          ? `scaleX(${progress / 100})`
                          : 'scaleX(0)',
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="sv-header">
              <div className="sv-header-left">
                <UserAvatar user={group.user} size="sm" />
                <span className="sv-header-name">{group.user.fullName}</span>
                <span className="sv-header-time">{storyTimeAgo(story.createdAt)}</span>
              </div>
              <div className="sv-header-right">
                {group.user.id === user.id && (
                  <button
                    className="sv-icon-btn"
                    onClick={(e) => { e.stopPropagation(); loadViewers(); }}
                    title="Views"
                  >
                    <Icon name="eye" size={18} />
                    <span className="sv-view-count">{story.views?.length || 0}</span>
                  </button>
                )}
                <button
                  className="sv-icon-btn"
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  aria-label="Close"
                >
                  <Icon name="close" size={22} />
                </button>
              </div>
            </div>

            {story.caption && (
              <div className="sv-caption">{story.caption}</div>
            )}

            {group.user.id === user.id && (
              <div className="sv-owner-actions">
                <button
                  className="sv-delete-btn"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            )}

            {viewersOpen && (
              <div className="sv-viewers-panel" onClick={(e) => e.stopPropagation()}>
                <div className="sv-viewers-header">
                  <span>Viewed by</span>
                  <button className="sv-icon-btn" onClick={() => setViewersOpen(false)}>
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <div className="sv-viewers-list">
                  {viewers.length === 0 ? (
                    <p className="sv-viewers-empty">No views yet</p>
                  ) : (
                    viewers.map((v) => (
                      <div key={v.id} className="sv-viewer-item">
                        <UserAvatar user={v.viewer} size="sm" />
                        <span>{v.viewer.fullName}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="sv-bottom-bar">
            <div className="sv-reply-row">
              <UserAvatar user={user} size="sm" />
              <input
                ref={replyInputRef}
                type="text"
                className="sv-reply-input"
                placeholder={`Reply to ${group.user.fullName.split(' ')[0]}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
              />
              {replyText.trim() && (
                <button className="sv-send-btn" onClick={sendReply} aria-label="Send reply">
                  <Icon name="send" size={18} />
                </button>
              )}
            </div>
            <div className="sv-reaction-row">
              <button className="sv-react-btn" title="Like">
                <Icon name="thumbOutline" size={20} />
              </button>
              <button className="sv-react-btn" title="Love">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/>
                </svg>
              </button>
              <button className="sv-react-btn" title="Comment">
                <Icon name="comment" size={20} />
              </button>
              <button className="sv-react-btn" title="Share">
                <Icon name="share" size={20} />
              </button>
            </div>
          </div>
        </div>

        {total > 1 && (
          <>
            <button className="sv-nav sv-nav-prev" onClick={onPrev} aria-label="Previous story">
              <Icon name="chevron_left" size={32} />
            </button>
            <button className="sv-nav sv-nav-next" onClick={onNext} aria-label="Next story">
              <Icon name="chevron_right" size={32} />
            </button>
          </>
        )}
      </div>

      {confirmDelete && (
        <Modal
          title="Delete Story"
          onClose={() => setConfirmDelete(false)}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={deleteStory} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          }
        >
          <p>Are you sure you want to delete this story? This action cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}
