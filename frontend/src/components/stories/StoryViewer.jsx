import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { storyService } from '../../services';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import Modal from '../common/Modal.jsx';

export default function StoryViewer({ group, total, onClose, onNext, onPrev }) {
  const { user } = useAuth();
  const { success, error } = useToastActions();
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const rafRef = useRef(null);
  const storyIndexRef = useRef(0);
  const DURATION = 5000;

  const story = group.stories[storyIndex];

  useEffect(() => {
    storyIndexRef.current = storyIndex;
  }, [storyIndex]);

  const markViewed = useCallback(async () => {
    if (!story || story.views?.some((v) => v.viewerId === user.id)) return;
    try {
      await storyService.view(story.id);
    } catch (err) {
      // ignore
    }
  }, [story, user.id]);

  useEffect(() => {
    markViewed();
  }, [markViewed]);

  useEffect(() => {
    if (!story) return undefined;
    // rAF-driven progress: transform-only updates stay on the compositor.
    setProgress(0);
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(100, (elapsed / DURATION) * 100));
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
  }, [story, story?.id, group.stories.length, onNext]);

  const loadViewers = async () => {
    setViewersOpen((o) => !o);
    if (!viewersOpen) {
      try {
        const data = await storyService.viewers(story.id);
        setViewers(data.views || []);
      } catch (err) {
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
    } catch (err) {
      error('Failed to delete story');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (!story) return null;

  return (
    <div className="story-viewer-backdrop" role="dialog" aria-modal="true">
      <div className="story-viewer">
        {story.mediaType === 'VIDEO' ? (
          <video src={story.url} className="story-media" autoPlay muted controls preload="metadata" />
        ) : (
          <img src={story.url} alt="" className="story-media" decoding="async" />
        )}

        <div className="story-progress-bar" style={{ top: 0, left: 16, right: 16 }}>
          <div className="story-progress-fill" style={{ transform: `scaleX(${progress / 100})` }} />
        </div>

        <div className="story-viewer-header">
          <UserAvatar user={group.user} size="sm" />
          <div>
            <div className="name">{group.user.fullName}</div>
            <div className="text-xs" style={{ opacity: 0.8 }}>Story {storyIndex + 1} of {group.stories.length}</div>
          </div>
        </div>

        <button className="icon-btn story-viewer-close" onClick={onClose} aria-label="Close story">
          <Icon name="close" size={20} />
        </button>

        {story.caption && <div className="story-viewer-caption">{story.caption}</div>}

        {group.user.id === user.id && (
          <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 2, display: 'flex', gap: 8 }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={loadViewers}
            >
              Views ({story.views?.length || 0})
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Icon name="delete" size={14} /> Delete
            </button>
          </div>
        )}

        {viewersOpen && (
          <div className="dropdown-menu" style={{ position: 'absolute', bottom: 56, right: 16, width: 280, maxHeight: 300, overflowY: 'auto' }}>
            <div className="dropdown-section-title">Viewed by</div>
            {viewers.length === 0 ? (
              <p className="text-sm text-muted" style={{ padding: 8 }}>No views yet</p>
            ) : (
              viewers.map((v) => (
                <div key={v.id} className="dropdown-item">
                  <UserAvatar user={v.viewer} size="sm" />
                  <span>{v.viewer.fullName}</span>
                </div>
              ))
            )}
          </div>
        )}

        {total > 1 && (
          <>
            <button className="story-viewer-nav prev" onClick={onPrev} aria-label="Previous story">
              <Icon name="chevron_left" />
            </button>
            <button className="story-viewer-nav next" onClick={onNext} aria-label="Next story">
              <Icon name="chevron_right" />
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