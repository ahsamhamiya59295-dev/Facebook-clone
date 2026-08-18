import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { userService, friendService } from '../../services';
import { useToastActions } from '../../context/ToastContext.jsx';

import UserAvatar from '../../components/common/UserAvatar.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Icon from '../../components/common/Icon.jsx';
import { timeAgo } from '../../utils/format.js';

export default function FriendRequestsPage() {
  const { loadFriends } = useAuth();
  const { success, error } = useToastActions();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userService.requests();
      setRequests(data.requests || []);
    } catch (err) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const accept = async (id) => {
    try {
      await friendService.accept(id);
      success('Friend request accepted');
      setRequests((r) => r.filter((x) => x.sender.id !== id));
      loadFriends();
    } catch (err) {
      error(err.message);
    }
  };

  const reject = async (id) => {
    try {
      await friendService.reject(id);
      setRequests((r) => r.filter((x) => x.sender.id !== id));
    } catch (err) {
      error(err.message);
    }
  };

  return (
    <div className="app-view">
      <aside className="app-rail" aria-label="Friends navigation">
        <div className="rail-header">
          <h2>Friends</h2>
        </div>
        <div className="rail-item" onClick={() => navigate('/friends')} role="button" tabIndex={0}>
          <span className="rail-icon"><Icon name="group" /></span>
          <span>Home</span>
        </div>
        <div className="rail-item active">
          <span className="rail-icon"><Icon name="search" /></span>
          <span>Friend requests</span>
          {requests.length > 0 && <span className="rail-count">{requests.length}</span>}
        </div>
        <div className="rail-item">
          <span className="rail-icon"><Icon name="follow" /></span>
          <span>Suggestions</span>
        </div>
        <div className="rail-item" onClick={() => navigate('/friends')} role="button" tabIndex={0}>
          <span className="rail-icon"><Icon name="friends" /></span>
          <span>All friends</span>
        </div>
      </aside>

      <div className="app-content wide">
        <div className="section-card">
          <h1 className="section-title">Friend Requests</h1>
        </div>
        {loading ? (
          <div className="loader-wrap"><div className="spinner" /></div>
        ) : requests.length === 0 ? (
          <EmptyState icon="friends" title="No pending requests" subtitle="When someone sends you a friend request, it will show up here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map((r) => (
              <div key={r.id} className="card">
                <div className="card-body">
                  <div className="user-row" style={{ cursor: 'default' }}>
                    <UserAvatar user={r.sender} size="lg" />
                    <div className="flex-grow">
                      <div className="user-name" onClick={() => navigate(`/profile/${r.sender.username}`)} style={{ cursor: 'pointer' }}>
                        {r.sender.fullName}
                      </div>
                      <div className="user-sub">@{r.sender.username} &middot; {timeAgo(r.createdAt)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => accept(r.sender.id)}>Confirm</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => reject(r.sender.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}