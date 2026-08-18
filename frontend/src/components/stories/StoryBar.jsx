import { useState, memo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import StoryViewer from './StoryViewer.jsx';
import StoryCreateModal from './StoryCreateModal.jsx';
import { timeAgo } from '../../utils/format.js';

function StoryBar({ stories, onRefresh }) {
  const { user } = useAuth();
  const [viewerIndex, setViewerIndex] = useState(null);
  const [creating, setCreating] = useState(false);

  if (viewerIndex !== null && stories.length > 0) {
    const group = stories[viewerIndex];
    return (
      <StoryViewer
        group={group}
        total={stories.length}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onNext={() => setViewerIndex((i) => (i + 1 < stories.length ? i + 1 : i))}
        onPrev={() => setViewerIndex((i) => (i > 0 ? i - 1 : i))}
      />
    );
  }

  return (
    <div className="story-bar" style={{ marginBottom: 16 }}>
      <button
        type="button"
        className="story-item create-story"
        onClick={() => setCreating(true)}
        aria-label="Create story"
      >
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="story-media" style={{ height: '55%' }} loading="lazy" decoding="async" />
        ) : (
          <div className="story-media" style={{ height: '55%', background: 'var(--bg)' }} />
        )}
        <div className="story-plus">
          <span className="plus-circle"><Icon name="plus" /></span>
          <span className="story-label">Create Story</span>
        </div>
      </button>

      {stories.map((g, i) => {
        const story = g.stories[0];
        const isMine = g.user.id === user.id;
        return (
          <button
            type="button"
            key={i}
            className="story-item"
            onClick={() => setViewerIndex(i)}
            aria-label={`Open ${g.user.fullName}'s story`}
          >
            <img src={story.url} alt="" className="story-media" loading="lazy" decoding="async" />
            <div className="story-overlay" aria-hidden="true" />
            <span className="story-user">
              <UserAvatar user={g.user} size="md" showRing={!g.allViewed && !isMine} />
            </span>
            <span className="story-name">{isMine ? 'Your Story' : g.user.fullName}</span>
            {!isMine && (
              <span className="story-time">{timeAgo(story.createdAt)}</span>
            )}
          </button>
        );
      })}

      {creating && <StoryCreateModal onClose={() => setCreating(false)} onCreated={onRefresh} />}
    </div>
  );
}

export default memo(StoryBar);