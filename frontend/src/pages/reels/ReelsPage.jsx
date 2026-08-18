import { useState, useEffect, useCallback } from 'react';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import ReactionButton from '../../components/reactions/ReactionButton.jsx';
import { videoService } from '../../services';

const PILLS = ['Home', 'Live', 'Reels', 'Shows', 'Saved'];

export default function ReelsPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await videoService.all();
      setVideos(data.videos || []);
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setReaction = (id, type) =>
    setReactions((prev) => ({ ...prev, [id]: type }));

  return (
    <div className="video-feed">
      <div className="video-feed-head">
        <h1 className="video-feed-title">Videos</h1>
        <div className="video-pills">
          {PILLS.map((cat, i) => (
            <button
              key={cat}
              type="button"
              className={`video-pill${i === 0 ? ' active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="video-list">
        {loading ? (
          <div className="video-loading">Loading videos…</div>
        ) : videos.length === 0 ? (
          <EmptyState icon="video" title="No videos yet" subtitle="Videos you add will appear here." />
        ) : (
          videos.map((vid) => (
            <div key={vid.id} className="video-card">
              <div className="video-card-head">
                <div className="video-creator">
                  <UserAvatar src={vid.avatarUrl} name={vid.creator} size="md" />
                  <div className="video-creator-meta">
                    <div className="video-creator-name">{vid.creator}</div>
                    <div className="video-creator-sub">{vid.views}</div>
                  </div>
                </div>
                <button type="button" className="video-more" aria-label="More">
                  <Icon name="more" size={20} />
                </button>
              </div>

              <div className="video-title">{vid.title}</div>

              <div className="video-thumb">
                <img src={vid.thumbnailUrl} alt={vid.title} loading="lazy" />
                <span className="video-play">
                  <Icon name="play" size={26} />
                </span>
              </div>

              <div className="video-actions">
                <ReactionButton
                  activeReaction={reactions[vid.id] || null}
                  onReact={(type) => setReaction(vid.id, type)}
                  onClear={() => setReaction(vid.id, null)}
                />
                <button type="button" className="video-action">
                  <Icon name="comment" size={18} /> Comment
                </button>
                <button type="button" className="video-action">
                  <Icon name="share" size={18} /> Share
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}