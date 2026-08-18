import { useState, useEffect } from 'react';
import { useToastActions } from '../../context/ToastContext.jsx';
import { friendService, userService } from '../../services';

export default function FriendButton({ targetUser, relation: initialRelation, compact = false, small = false, onStatusChange, className = '' }) {
  const [relation, setRelation] = useState(initialRelation || 'NONE');
  const [loading, setLoading] = useState(false);
  const { success, error } = useToastActions();

  useEffect(() => {
    if (initialRelation) setRelation(initialRelation);
  }, [initialRelation]);

  const update = (newRelation) => {
    setRelation(newRelation);
    onStatusChange?.(newRelation);
  };

  const send = async () => {
    setLoading(true);
    try {
      const data = await friendService.send(targetUser.id);
      update(data.status || 'REQUEST_SENT');
      success(data.status === 'FRIENDS' ? 'You are now friends' : 'Friend request sent');
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const accept = async () => {
    setLoading(true);
    try {
      await friendService.accept(targetUser.id);
      update('FRIENDS');
      success('Friend request accepted');
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reject = async () => {
    setLoading(true);
    try {
      await friendService.reject(targetUser.id);
      update('NONE');
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    setLoading(true);
    try {
      await friendService.cancel(targetUser.id);
      update('NONE');
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const unfriend = async () => {
    setLoading(true);
    try {
      await friendService.remove(targetUser.id);
      update('NONE');
      success('Removed friend');
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <button
        className={`btn btn-sm ${className || (relation === 'REQUEST_RECEIVED' ? 'btn-primary' : 'btn-secondary')}`}
        onClick={send}
        disabled={loading || relation === 'FRIENDS' || relation === 'BLOCKED'}
        aria-label="Add friend"
      >
        {relation === 'FRIENDS' ? 'Friends' : 'Add'}
      </button>
    );
  }

  return (
    <div className="d-flex" style={{ display: 'flex', gap: 8 }}>
      {relation === 'NONE' && (
        <button className={`btn ${small ? 'btn-sm' : ''} btn-primary`} onClick={send} disabled={loading}>
          Add Friend
        </button>
      )}
      {relation === 'REQUEST_SENT' && (
        <button className="btn btn-secondary" onClick={cancel} disabled={loading}>
          Cancel Request
        </button>
      )}
      {relation === 'REQUEST_RECEIVED' && (
        <>
          <button className="btn btn-primary" onClick={accept} disabled={loading}>
            Confirm
          </button>
          <button className="btn btn-secondary" onClick={reject} disabled={loading}>
            Delete
          </button>
        </>
      )}
      {relation === 'FRIENDS' && (
        <button className="btn btn-secondary" onClick={unfriend} disabled={loading}>
          Friends
        </button>
      )}
      {relation === 'BLOCKED' && <button className="btn btn-secondary" disabled>Blocked</button>}
      {!initialRelation && relation === 'NONE' && (
        <button className="btn btn-secondary" disabled>Add Friend</button>
      )}
    </div>
  );
}

export function FollowButton({ targetUser, following: initialFollowing, onStatusChange }) {
  const [following, setFollowing] = useState(Boolean(initialFollowing));
  const [loading, setLoading] = useState(false);
  useToastActions();

  useEffect(() => setFollowing(Boolean(initialFollowing)), [initialFollowing]);

  const toggle = async () => {
    setLoading(true);
    try {
      if (following) await userService.unfollow(targetUser.id);
      else await userService.follow(targetUser.id);
      setFollowing(!following);
      onStatusChange?.(!following);
    } catch (err) {
      // handled by toasts elsewhere
    } finally {
      setLoading(false);
    }
  };

  return (
    <button className={`btn ${following ? 'btn-secondary' : 'btn-primary'}`} onClick={toggle} disabled={loading}>
      {following ? 'Following' : 'Follow'}
    </button>
  );
}