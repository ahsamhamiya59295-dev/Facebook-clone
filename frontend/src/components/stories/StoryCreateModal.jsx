import { useState, useRef, useEffect, memo } from 'react';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { storyService } from '../../services';
import { fileToUrl } from '../../utils/format.js';

const PRIVACY = [
  { value: 'PUBLIC', label: 'Public', icon: 'globe' },
  { value: 'FRIENDS', label: 'Friends', icon: 'friends' },
];

export default memo(function StoryCreateModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const { success, error } = useToastActions();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState('PUBLIC');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const previewRef = useRef('');
  const textareaRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = '';
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = fileToUrl(f);
    previewRef.current = url;
    setFile(f);
    setPreview(url);
    setIsVideo(f.type.startsWith('video'));
    e.target.value = '';
  };

  const submit = async () => {
    if (!file) {
      error('Choose a photo or video for your story');
      return;
    }
    setSubmitting(true);
    try {
      await storyService.create(file, caption.trim());
      success('Story shared');
      onCreated?.();
      onClose?.();
    } catch (err) {
      error(err.message || 'Failed to share story');
    } finally {
      setSubmitting(false);
    }
  };

  const currentPrivacy = PRIVACY.find((p) => p.value === privacy);

  return (
    <div className="scm-backdrop" onClick={onClose}>
      <div className="scm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="scm-header">
          <button className="scm-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={22} />
          </button>
          <span className="scm-title">Create story</span>
          <div style={{ width: 40 }} />
        </div>

        {/* Body */}
        <div className="scm-body">
          {/* User info */}
          <div className="scm-user-row">
            <UserAvatar user={user} size="md" />
            <div className="scm-user-info">
              <span className="scm-user-name">{user.fullName}</span>
              <button className="scm-privacy-btn" onClick={() => setShowPrivacy((s) => !s)}>
                <Icon name={currentPrivacy.icon} size={12} />
                <span>{currentPrivacy.label}</span>
                <Icon name="chevron" size={12} />
              </button>
              {showPrivacy && (
                <div className="scm-privacy-dropdown">
                  {PRIVACY.map((p) => (
                    <div
                      key={p.value}
                      className={`scm-privacy-option${privacy === p.value ? ' active' : ''}`}
                      onClick={() => { setPrivacy(p.value); setShowPrivacy(false); }}
                    >
                      <Icon name={p.icon} size={16} />
                      <span>{p.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Preview area */}
          <div className={`scm-preview${preview ? '' : ' empty'}`}>
            {preview ? (
              <>
                {isVideo
                  ? <video src={preview} muted autoPlay loop playsInline />
                  : <img src={preview} alt="Story preview" />
                }
                <button className="scm-change-btn" onClick={() => fileInputRef.current?.click()} aria-label="Change media">
                  <Icon name="camera" size={18} />
                </button>
              </>
            ) : (
              <button className="scm-upload-btn" onClick={() => fileInputRef.current?.click()}>
                <div className="scm-upload-icon">
                  <Icon name="camera" size={36} />
                </div>
                <span className="scm-upload-text">Add photo or video</span>
                <span className="scm-upload-hint">or drag and drop</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={pickFile} />
          </div>

          {/* Caption */}
          <div className="scm-caption-area">
            <textarea
              ref={textareaRef}
              className="scm-caption-input"
              placeholder={`What's on your mind, ${user.fullName?.split(' ')[0]}?`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="scm-footer">
          <div className="scm-footer-left">
            <button className="scm-action-btn" onClick={() => fileInputRef.current?.click()}>
              <Icon name="image" size={20} />
              <span>Photo</span>
            </button>
            <button className="scm-action-btn" onClick={() => fileInputRef.current?.click()}>
              <Icon name="video" size={20} />
              <span>Video</span>
            </button>
          </div>
          <button className="scm-share-btn" onClick={submit} disabled={submitting || !file}>
            {submitting ? (
              <span className="spinner spinner-sm" />
            ) : (
              <>Share to Story</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
