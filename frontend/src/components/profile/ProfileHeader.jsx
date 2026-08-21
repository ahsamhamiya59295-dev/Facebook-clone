import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { userService, messageService } from '../../services';
import { mediaUrl } from '../../utils/helpers.js';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import Modal from '../common/Modal.jsx';
import FriendButton, { FollowButton } from '../friends/FriendButton.jsx';

function EditProfileModal({ user, onSaved, onClose }) {
  const { apiError } = useAuth();
  const { success, error } = useToastActions();
  const [form, setForm] = useState({
    fullName: user.fullName,
    username: user.username,
    bio: user.bio || '',
    location: user.location || '',
    work: user.work || '',
    education: user.education || '',
    website: user.website || '',
    relationshipStatus: user.relationshipStatus || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    try {
      await userService.updateMe({ ...form, profile: { bio: form.bio, location: form.location, work: form.work, education: form.education, website: form.website, relationshipStatus: form.relationshipStatus } });
      success('Profile updated');
      onSaved?.();
      onClose?.();
    } catch (err) {
      error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit Profile" onClose={onClose} footer={
      <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
    }>
      <div className="form-group">
        <label className="form-label">Full name</label>
        <input className="form-input" value={form.fullName} onChange={set('fullName')} />
      </div>
      <div className="form-group">
        <label className="form-label">Username</label>
        <input className="form-input" value={form.username} onChange={set('username')} />
      </div>
      <div className="form-group">
        <label className="form-label">Bio</label>
        <textarea className="form-textarea" value={form.bio} onChange={set('bio')} placeholder="Tell people about yourself" />
      </div>
      <div className="form-group">
        <label className="form-label">Work</label>
        <input className="form-input" value={form.work} onChange={set('work')} />
      </div>
      <div className="form-group">
        <label className="form-label">Education</label>
        <input className="form-input" value={form.education} onChange={set('education')} />
      </div>
      <div className="form-group">
        <label className="form-label">Location</label>
        <input className="form-input" value={form.location} onChange={set('location')} />
      </div>
      <div className="form-group">
        <label className="form-label">Website</label>
        <input className="form-input" value={form.website} onChange={set('website')} />
      </div>
      <div className="form-group">
        <label className="form-label">Relationship status</label>
        <select className="form-select" value={form.relationshipStatus} onChange={set('relationshipStatus')}>
          <option value="">-</option>
          <option>Single</option>
          <option>In a relationship</option>
          <option>Engaged</option>
          <option>Married</option>
          <option>It&apos;s complicated</option>
        </select>
      </div>
    </Modal>
  );
}

export default function ProfileHeader({ profile, isOwner, relation, following, onProfileChanged }) {
  const { updateUser, apiError } = useAuth();
  const { success, error } = useToastActions();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [savingImg, setSavingImg] = useState(null);
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);
  const [confirmRemoveCover, setConfirmRemoveCover] = useState(false);
  const avatarInput = useRef(null);
  const coverInput = useRef(null);

  const uploadAvatar = async (file) => {
    if (!file) return;
    setSavingImg('avatar');
    try {
      const data = await userService.avatar(file);
      updateUser({ avatarUrl: data.avatarUrl });
      onProfileChanged?.();
      success('Profile picture updated');
    } catch (err) {
      error(apiError(err));
    } finally {
      setSavingImg(null);
    }
  };

  const uploadCover = async (file) => {
    if (!file) return;
    setSavingImg('cover');
    try {
      const data = await userService.cover(file);
      updateUser({ coverUrl: data.coverUrl });
      onProfileChanged?.();
      success('Cover photo updated');
    } catch (err) {
      error(apiError(err));
    } finally {
      setSavingImg(null);
    }
  };

  const removeAvatar = async () => {
    setSavingImg('avatar');
    try {
      await userService.removeAvatar();
      updateUser({ avatarUrl: null });
      onProfileChanged?.();
      success('Profile picture removed');
    } catch (err) {
      error(apiError(err));
    } finally {
      setSavingImg(null);
      setConfirmRemoveAvatar(false);
    }
  };

  const removeCover = async () => {
    setSavingImg('cover');
    try {
      await userService.removeCover();
      updateUser({ coverUrl: null });
      onProfileChanged?.();
      success('Cover photo removed');
    } catch (err) {
      error(apiError(err));
    } finally {
      setSavingImg(null);
      setConfirmRemoveCover(false);
    }
  };

  const message = async () => {
    try {
      const data = await messageService.create(profile.id);
      navigate(`/messages/${data.conversation.id}`);
    } catch (err) {
      error(apiError(err));
    }
  };

  return (
    <div className="profile-header">
      <div className="profile-cover">
        {profile.coverUrl ? <img src={mediaUrl(profile.coverUrl)} alt="Cover" loading="lazy" decoding="async" /> : null}
        {isOwner && (
          <div className="profile-cover-overlay">
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.95)' }} onClick={() => coverInput.current?.click()} disabled={savingImg === 'cover'}>
              <Icon name="camera" size={16} /> {savingImg === 'cover' ? 'Uploading...' : 'Edit cover photo'}
            </button>
            {profile.coverUrl && (
              <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.95)' }} onClick={() => setConfirmRemoveCover(true)} disabled={savingImg === 'cover'}>
                <Icon name="delete" size={16} /> Remove
              </button>
            )}
            <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => uploadCover(e.target.files[0])} />
          </div>
        )}
      </div>

      <div className="profile-info">
        <div className="profile-banner">
          <div className="profile-banner-avatar">
            <button
              className="profile-avatar-border"
              onClick={() => isOwner && avatarInput.current?.click()}
              disabled={!isOwner}
              aria-label="Profile picture"
            >
              <UserAvatar user={profile} size="xl" />
              {isOwner && <span className="profile-avatar-camera"><Icon name="camera" size={18} /></span>}
            </button>
            {isOwner && profile.avatarUrl && (
              <button
                className="btn btn-icon"
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={(e) => { e.stopPropagation(); setConfirmRemoveAvatar(true); }}
                disabled={savingImg === 'avatar'}
                aria-label="Remove profile picture"
              >
                <Icon name="close" size={14} />
              </button>
            )}
            {isOwner && <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => uploadAvatar(e.target.files[0])} />}
          </div>

          <div className="profile-banner-content">
            <h1 className="profile-name">
              {profile.fullName}
              <Icon name="verified" size={22} style={{ fill: 'var(--fb-blue)', marginLeft: 6, verticalAlign: 'middle' }} />
            </h1>
            <div className="profile-stats">
              <span><span className="num">{profile._count?.posts || 0}</span> posts</span>
              <span><span className="num">{profile._count?.friends || 0}</span> friends</span>
              <span><span className="num">{profile._count?.followers || 0}</span> followers</span>
              <span><span className="num">{profile._count?.following || 0}</span> following</span>
            </div>
          </div>

          <div className="profile-actions">
            {isOwner ? (
              <>
                <button className="btn btn-primary" onClick={() => setEditOpen(true)}>
                  <Icon name="edit" size={16} /> Edit profile
                </button>
                <button className="btn btn-secondary" onClick={() => coverInput.current?.click()}>
                  <Icon name="camera" size={16} /> Edit cover
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/settings')}>
                  <Icon name="settings" size={16} /> Settings
                </button>
              </>
            ) : (
              <>
                <FriendButton targetUser={profile} relation={relation} />
                <FollowButton targetUser={profile} following={following} />
                <button className="btn btn-secondary" onClick={message}>
                  <Icon name="messenger" size={16} /> Message
                </button>
              </>
            )}
          </div>
        </div>
        {profile.bio && <div className="profile-bio">{profile.bio}</div>}
      </div>

      {editOpen && <EditProfileModal user={profile} onSaved={onProfileChanged} onClose={() => setEditOpen(false)} />}

      {confirmRemoveAvatar && (
        <Modal
          title="Remove Profile Picture"
          onClose={() => setConfirmRemoveAvatar(false)}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmRemoveAvatar(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={removeAvatar} disabled={savingImg === 'avatar'}>
                {savingImg === 'avatar' ? 'Removing...' : 'Remove'}
              </button>
            </div>
          }
        >
          <p>Are you sure you want to remove your profile picture?</p>
        </Modal>
      )}

      {confirmRemoveCover && (
        <Modal
          title="Remove Cover Photo"
          onClose={() => setConfirmRemoveCover(false)}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmRemoveCover(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={removeCover} disabled={savingImg === 'cover'}>
                {savingImg === 'cover' ? 'Removing...' : 'Remove'}
              </button>
            </div>
          }
        >
          <p>Are you sure you want to remove your cover photo?</p>
        </Modal>
      )}
    </div>
  );
}