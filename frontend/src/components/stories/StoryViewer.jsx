import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { storyService } from '../../services';
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

const REACTIONS = [
  { emoji: '\u{1F44D}', name: 'Like' },
  { emoji: '\u{2764}\u{FE0F}', name: 'Love' },
  { emoji: '\u{1F970}', name: 'Care' },
  { emoji: '\u{1F602}', name: 'Haha' },
  { emoji: '\u{1F62E}', name: 'Wow' },
  { emoji: '\u{1F622}', name: 'Sad' },
  { emoji: '\u{1F525}', name: 'Fire' },
];

export default function StoryViewer({ group, total, onClose, onNext, onPrev }) {
  const { user } = useAuth();
  const { success, error } = useToastActions();
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [showToast, setShowToast] = useState(null);
  const progressRef = useRef(0);
  const holdingRef = useRef(false);

  const story = group.stories[storyIndex];

  const handleNext = useCallback(() => {
    if (storyIndex + 1 < group.stories.length) {
      setStoryIndex((i) => i + 1);
    } else {
      onNext?.();
    }
  }, [storyIndex, group.stories.length, onNext]);

  const handlePrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else {
      onPrev?.();
    }
  }, [storyIndex, onPrev]);

  const markViewed = useCallback(async () => {
    if (!story || story.views?.some((v) => v.viewerId === user.id)) return;
    try {
      await storyService.view(story.id);
    } catch { /* ignore */ }
  }, [story, user.id]);

  useEffect(() => { markViewed(); }, [markViewed]);

  useEffect(() => {
    if (!story || paused || holdingRef.current) return undefined;
    setProgress(0);
    const duration = 5000;
    const startTime = Date.now();
    let raf;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const p = Math.min(100, (elapsed / duration) * 100);
      setProgress(p);
      progressRef.current = p;
      if (elapsed >= duration) {
        handleNext();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story, story?.id, paused, handleNext]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      else if (e.key === ' ' && e.target?.tagName !== 'INPUT') { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, handleNext, handlePrev]);

  const handleViewportClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width * 0.3) {
      handlePrev();
    } else {
      handleNext();
    }
  };

  const handlePointerDown = () => { holdingRef.current = true; setIsHolding(true); };
  const handlePointerUp = () => { holdingRef.current = false; setIsHolding(false); };

  const loadViewers = async () => {
    setViewersOpen((o) => !o);
    if (!viewersOpen) {
      try {
        const data = await storyService.viewers(story.id);
        setViewers(data.views || []);
      } catch { /* ignore */ }
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

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setShowToast(`Reply sent to ${group.user.fullName.split(' ')[0]}`);
    setTimeout(() => setShowToast(null), 3000);
    setReplyText('');
  };

  const sendReaction = (emoji) => {
    const id = `react-${Date.now()}`;
    const xOffset = (Math.random() - 0.5) * 60;
    setFloatingReactions((prev) => [...prev, { id, emoji, xOffset }]);
    setTimeout(() => { setFloatingReactions((prev) => prev.filter((r) => r.id !== id)); }, 2000);
  };

  if (!story) return null;

  return (
    <div className="sv-backdrop" role="dialog" aria-modal="true">
      {showToast && (
        <div className="sv-toast">
          <span>&#10003;</span> {showToast}
        </div>
      )}

      <div className="sv-floating-reactions">
        {floatingReactions.map((r) => (
          <div key={r.id} className="sv-float-emoji" style={{ transform: `translateX(${r.xOffset}px)` }}>
            {r.emoji}
          </div>
        ))}
      </div>

      <div className="sv-container">
        <div className="sv-story-column">
          <div
            className="sv-story-card"
            onClick={handleViewportClick}
            onMouseDown={handlePointerDown}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchEnd={handlePointerUp}
          >
            {story.mediaType === 'VIDEO' ? (
              <video src={story.url} className="sv-media" autoPlay muted loop={false} playsInline preload="metadata" />
            ) : (
              <img src={story.url} alt="" className="sv-media" decoding="async" />
            )}

            <div className="sv-top-overlay">
              <div className="sv-progress-track">
                {group.stories.map((s, i) => {
                  let fillWidth = '0%';
                  if (i < storyIndex) fillWidth = '100%';
                  else if (i === storyIndex) fillWidth = `${progress}%`;
                  return (
                    <div key={s.id} className="sv-progress-segment">
                      <div className="sv-progress-bg" />
                      <div className="sv-progress-fill" style={{ width: fillWidth }} />
                    </div>
                  );
                })}
              </div>

              <div className="sv-header" onClick={(e) => e.stopPropagation()}>
                <div className="sv-header-left">
                  <div className="sv-avatar-ring">
                    <UserAvatar user={group.user} size="sm" />
                  </div>
                  <span className="sv-header-name">{group.user.fullName}</span>
                  <span className="sv-header-dot">&middot;</span>
                  <span className="sv-header-time">{storyTimeAgo(story.createdAt)}</span>
                </div>
                <div className="sv-header-right">
                  <button className="sv-hdr-btn" onClick={() => setPaused((p) => !p)} title={paused ? 'Play' : 'Pause'}>
                    {paused ? <Icon name="play" size={16} /> : <Icon name="pause" size={16} />}
                  </button>
                  {group.user.id === user.id && (
                    <button className="sv-hdr-btn" onClick={loadViewers} title="Views">
                      <Icon name="eye" size={16} />
                      <span className="sv-view-count">{story.views?.length || 0}</span>
                    </button>
                  )}
                  <button className="sv-hdr-btn" onClick={() => onClose()} aria-label="Close">
                    <Icon name="close" size={20} />
                  </button>
                </div>
              </div>
            </div>

            {story.caption && <div className="sv-caption">{story.caption}</div>}

            {group.user.id === user.id && (
              <div className="sv-owner-actions" onClick={(e) => e.stopPropagation()}>
                <button className="sv-delete-btn" onClick={() => setConfirmDelete(true)}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            )}

            {viewersOpen && (
              <div className="sv-viewers-panel" onClick={(e) => e.stopPropagation()}>
                <div className="sv-viewers-header">
                  <span>Viewed by</span>
                  <button className="sv-icon-btn" onClick={() => setViewersOpen(false)}>
                    <Icon name="close" size={14} />
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

          <div className="sv-bottom-bar" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSendReply} className="sv-reply-row">
              <input
                type="text"
                className="sv-reply-input"
                placeholder={`Reply to ${group.user.fullName.split(' ')[0]}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <button type="submit" disabled={!replyText.trim()} className="sv-send-btn">
                <Icon name="send" size={16} />
              </button>
            </form>
            <div className="sv-reaction-row">
              {REACTIONS.map((r) => (
                <button key={r.name} className="sv-react-btn" title={r.name} onClick={() => sendReaction(r.emoji)}>
                  {r.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        {total > 1 && (
          <>
            <button
              className="sv-nav sv-nav-prev"
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              disabled={storyIndex === 0 && !onPrev}
              aria-label="Previous story"
            >
              <Icon name="chevron_left" size={28} />
            </button>
            <button
              className="sv-nav sv-nav-next"
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              aria-label="Next story"
            >
              <Icon name="chevron_right" size={28} />
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
