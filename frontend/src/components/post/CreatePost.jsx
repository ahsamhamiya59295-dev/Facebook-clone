import { useState, useRef, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../common/Modal.jsx';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { postService } from '../../services';
import { PRIVACY_LEVELS, PRIVACY_ICON } from '../../constants';
import { fileToUrl } from '../../utils/format.js';

const PRIVACY_LABEL = { PUBLIC: 'Public', FRIENDS: 'Friends', ONLY_ME: 'Only Me' };

export default memo(function CreatePost({ onPosted }) {
  const { user, apiError } = useAuth();
  const { success, error } = useToastActions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [privacy, setPrivacy] = useState('PUBLIC');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setContent('');
      setFiles([]);
      setPreviews((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
      setPrivacy('PUBLIC');
    }
  }, [open]);

  const onFilesSelected = (list) => {
    const arr = Array.from(list);
    setFiles((prev) => [...prev, ...arr]);
    setPreviews((prev) => [...prev, ...arr.map((f) => ({ url: fileToUrl(f), type: f.type.startsWith('video') ? 'VIDEO' : 'IMAGE' }))]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const submit = async () => {
    if (!content.trim() && files.length === 0) {
      error('Write something or add a photo/video');
      return;
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.append('content', content.trim());
    fd.append('privacy', privacy);
    files.forEach((f) => fd.append('files', f));
    try {
      const data = await postService.create(fd);
      success('Post published');
      onPosted?.(data.post);
      setOpen(false);
    } catch (err) {
      error(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="card">
        <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <UserAvatar user={user} size="md" onClick={() => navigate(`/profile/${user.username}`)} />
          <button
            className="composer-textarea"
            style={{ flex: 1, textAlign: 'left', minHeight: 44, padding: '0 16px', display: 'flex', alignItems: 'center', background: 'var(--bg)', borderRadius: 50, color: 'var(--text-secondary)', fontWeight: 400 }}
            onClick={() => setOpen(true)}
          >
            What&apos;s on your mind, {user.fullName?.split(' ')[0]}?
          </button>
        </div>
        <div className="composer-divider" style={{ margin: '0 16px' }} />
        <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
          <button className="composer-action-button red" onClick={() => setOpen(true)}>
            <Icon name="video" /> <span className="action-label">Live video</span>
          </button>
          <button className="composer-action-button photo" onClick={() => setOpen(true)}>
            <Icon name="image" /> <span className="action-label">Photo/video</span>
          </button>
          <button className="composer-action-button feeling" onClick={() => setOpen(true)}>
            <Icon name="emoji" /> <span className="action-label">Feeling/activity</span>
          </button>
        </div>
      </div>

      {open && (
        <Modal
          title={`Create post`}
          onClose={() => setOpen(false)}
          footer={
            <button className="btn btn-primary btn-block" onClick={submit} disabled={submitting}>
              {submitting ? 'Posting...' : 'Post'}
            </button>
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <UserAvatar user={user} size="lg" />
            <div>
              <div className="text-bold">{user.fullName}</div>
              <button className="audience-picker" onClick={() => setShowPrivacy((s) => !s)}>
                <Icon name={PRIVACY_ICON[privacy]} size={14} />
                {PRIVACY_LABEL[privacy]}
                <Icon name="chevron" />
              </button>
              {showPrivacy && (
                <div className="dropdown-menu" style={{ position: 'absolute', zIndex: 60 }}>
                  {PRIVACY_LEVELS.map((p) => (
                    <div key={p.value} className="dropdown-item" onClick={() => { setPrivacy(p.value); setShowPrivacy(false); }}>
                      <Icon name={p.icon} />
                      <span>{p.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <textarea
            className="composer-textarea"
            placeholder={`What's on your mind, ${user.fullName?.split(' ')[0]}?`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            autoFocus
          />

          {previews.length > 0 && (
            <div className="composer-preview-grid">
              {previews.map((p, i) => (
                <div className="composer-preview" key={i}>
                  {p.type === 'VIDEO' ? (
                    <video src={p.url} muted />
                  ) : (
                    <img src={p.url} alt={`Preview ${i}`} />
                  )}
                  <button className="remove" onClick={() => removeFile(i)} aria-label="Remove">
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="composer-divider" />
          <div className="composer-actions">
            <span className="text-bold">Add to your post</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                hidden
                onChange={(e) => onFilesSelected(e.target.files)}
              />
              <button className="icon-btn" style={{ background: 'transparent', color: 'var(--green)' }} onClick={() => fileInputRef.current?.click()} aria-label="Add photos">
                <Icon name="image" size={24} />
              </button>
              <button className="icon-btn" style={{ background: 'transparent', color: 'var(--yellow)' }} aria-label="Add feeling">
                <Icon name="emoji" size={24} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
});