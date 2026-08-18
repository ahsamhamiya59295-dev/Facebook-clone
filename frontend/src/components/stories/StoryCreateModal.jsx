import { useState, useRef, useEffect, memo } from 'react';
import Modal from '../common/Modal.jsx';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { storyService } from '../../services';
import { fileToUrl } from '../../utils/format.js';

export default memo(function StoryCreateModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const { success, error } = useToastActions();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const previewRef = useRef('');

  // Revoke the previous object URL whenever a new file is picked and when the
  // modal unmounts so blob URLs never leak.
  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = '';
      }
    };
  }, []);

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

  return (
    <Modal
      title="Create story"
      onClose={onClose}
      maxWidth={520}
      footer={
        <button className="btn btn-primary btn-block" onClick={submit} disabled={submitting || !file}>
          {submitting ? 'Sharing...' : 'Share to Story'}
        </button>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <UserAvatar user={user} size="lg" />
        <div>
          <div className="text-bold">{user.fullName}</div>
          <span className="text-muted text-sm">Your story</span>
        </div>
      </div>

      <div className={`story-create-preview${preview ? '' : ' empty'}`}>
        {preview ? (
          isVideo
            ? <video src={preview} muted controls playsInline />
            : <img src={preview} alt="Story preview" />
        ) : (
          <button type="button" className="story-create-empty" onClick={() => fileInputRef.current?.click()}>
            <Icon name="camera" size={40} />
            <span className="text-bold">Add photo or video</span>
          </button>
        )}
        {preview && (
          <button type="button" className="story-create-change" onClick={() => fileInputRef.current?.click()} aria-label="Choose another photo or video">
            <Icon name="camera" size={18} />
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={pickFile} aria-label="Upload story media" />
      </div>

      <textarea
        className="composer-textarea"
        placeholder="Say something about your story..."
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={2}
        maxLength={1000}
      />
    </Modal>
  );
});