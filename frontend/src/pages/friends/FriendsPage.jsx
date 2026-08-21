import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { userService, friendService } from '../../services';
import { useToastActions } from '../../context/ToastContext.jsx';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import SkeletonRow from '../../components/common/Skeleton.jsx';
import { mediaUrl } from '../../utils/helpers.js';
import { timeAgo } from '../../utils/format.js';

function Photo({ user, className = '' }) {
  const url = mediaUrl(user.avatarUrl);
  if (url) {
    return <img src={url} alt={user.fullName || user.username || ''} loading="lazy" className={className} />;
  }
  return <span className={`${className} pyo-photo-fallback`}><UserAvatar user={user} size="xl" /></span>;
}

function RequestCard({ request, confirmed, onConfirm, onDelete, onOpen }) {
  const sender = request.sender;
  const time = request.createdAt ? timeAgo(request.createdAt) : null;
  return (
    <div className="pyo-card">
      <button type="button" className="pyo-photo" onClick={onOpen} aria-label={sender.fullName}>
        <Photo user={sender} className="pyo-photo-img" />
        {time && <span className="pyo-time-badge">{time}</span>}
      </button>
      <div className="pyo-body">
        <h3 className="pyo-name" onClick={onOpen}>{sender.fullName}</h3>
        <p className="pyo-mutual">{request.mutualCount || 0} mutual friends</p>
        <div className="pyo-actions">
          {confirmed ? (
            <div className="pyo-chip pyo-chip-primary">
              <Icon name="check" size={14} /> Request accepted
            </div>
          ) : (
            <>
              <button type="button" className="pyo-btn pyo-btn-primary" onClick={onConfirm}>
                <Icon name="userCheck" size={14} /> Confirm
              </button>
              <button type="button" className="pyo-btn pyo-btn-secondary" onClick={onDelete}>
                <Icon name="userX" size={14} /> Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion, added, onAdd, onRemove, onOpen }) {
  return (
    <div className="pyo-card">
      <button type="button" className="pyo-photo" onClick={onOpen} aria-label={suggestion.fullName}>
        <Photo user={suggestion} className="pyo-photo-img" />
      </button>
      <div className="pyo-body">
        <h3 className="pyo-name" onClick={onOpen}>{suggestion.fullName}</h3>
        <p className="pyo-mutual">{suggestion.mutualCount || 0} mutual friends</p>
        <div className="pyo-actions">
          {added ? (
            <div className="pyo-chip pyo-chip-muted">
              <Icon name="check" size={14} /> Request sent
            </div>
          ) : (
            <>
              <button type="button" className="pyo-btn pyo-btn-soft" onClick={onAdd}>
                <Icon name="userPlus" size={14} /> Add friend
              </button>
              <button type="button" className="pyo-btn pyo-btn-secondary" onClick={onRemove}>
                Remove
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FriendsPage() {
  const { success, error } = useToastActions();
  const { loadFriends } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [addedIds, setAddedIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        userService.requests(),
        userService.suggestions(12),
      ]);
      setRequests(r.requests || []);
      setSuggestions(s.users || []);
    } catch (err) {
      setRequests([]);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const acceptRequest = async (senderId) => {
    try {
      await friendService.accept(senderId);
      setRequests((prev) => prev.filter((x) => x.sender.id !== senderId));
      success('Friend request accepted');
      loadFriends();
    } catch (err) {
      error(err.message || 'Could not accept request');
    }
  };

  const rejectRequest = async (senderId) => {
    try {
      await friendService.reject(senderId);
      setRequests((prev) => prev.filter((x) => x.sender.id !== senderId));
    } catch (err) {
      error(err.message || 'Could not delete request');
    }
  };

  const sendRequest = async (id) => {
    try {
      await friendService.send(id);
      setAddedIds((prev) => [...prev, id]);
      success('Friend request sent');
    } catch (err) {
      error(err.message || 'Could not send request');
    }
  };

  const openProfile = (u) => () => navigate(`/profile/${u.username}`);

  return (
    <div className="pyo-container">
      <section aria-labelledby="requests-heading">
        <div className="pyo-section-head">
          <div>
            <h1 className="pyo-title" id="requests-heading">
              Friend Requests
              {requests.length > 0 && (
                <span className="pyo-count-badge">
                  {requests.length}
                </span>
              )}
            </h1>
            <p className="pyo-subtitle">Respond to people who sent you friend requests</p>
          </div>
        </div>

        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : requests.length === 0 ? (
          <EmptyState icon="friends" title="No pending requests" subtitle="When someone sends you a friend request it'll show up here." />
        ) : (
          <div className="pyo-grid">
            {requests.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                confirmed={false}
                onConfirm={() => acceptRequest(r.sender.id)}
                onDelete={() => rejectRequest(r.sender.id)}
                onOpen={openProfile(r.sender)}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="suggestions-heading" className="pyo-section-divider">
        <div className="pyo-section-head">
          <div>
            <h2 className="pyo-title" id="suggestions-heading">People You May Know</h2>
            <p className="pyo-subtitle">Friend suggestions based on your mutual friends and connections</p>
          </div>
        </div>

        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : suggestions.length === 0 ? (
          <EmptyState icon="follow" title="No suggestions right now" subtitle="We'll show people you may know here." />
        ) : (
          <div className="pyo-grid">
            {suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                added={addedIds.includes(s.id)}
                onAdd={() => sendRequest(s.id)}
                onRemove={() => setSuggestions((prev) => prev.filter((x) => x.id !== s.id))}
                onOpen={openProfile(s)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
