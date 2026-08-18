import { useState, useEffect, useCallback } from 'react';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { streamService } from '../../services';

export default function GamingPage() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await streamService.all();
      setStreams(data.streams || []);
    } catch {
      setStreams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="gaming-feed">
      <div className="gaming-feed-head">
        <h1 className="gaming-title">
          <Icon name="gamepad2" size={24} />
          Gaming Streams &amp; Clips
        </h1>
      </div>

      <div className="gaming-grid">
        {loading ? (
          <div className="gaming-loading">Loading streams…</div>
        ) : streams.length === 0 ? (
          <EmptyState icon="gamepad2" title="No live streams right now" subtitle="Streams will show here when available." />
        ) : (
          streams.map((stream) => (
            <div key={stream.id} className="gaming-card">
              <div className="gaming-thumb">
                <img src={stream.thumbnailUrl} alt={stream.title} loading="lazy" />
                <span className="gaming-live">
                  <Icon name="radio" size={12} /> LIVE
                </span>
                <span className="gaming-viewers">
                  <Icon name="eye" size={12} /> {stream.viewers} viewers
                </span>
              </div>

              <div className="gaming-body">
                <UserAvatar src={stream.avatarUrl} name={stream.streamer} size="md" />
                <div className="gaming-info">
                  <h3 className="gaming-name">{stream.title}</h3>
                  <p className="gaming-streamer">{stream.streamer}</p>
                  <p className="gaming-game">{stream.game}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}