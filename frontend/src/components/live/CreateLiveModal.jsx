import { useState } from 'react';
import Icon from '../common/Icon';
import { liveService } from '../../services';

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', desc: 'Anyone can watch' },
  { value: 'FRIENDS', label: 'Friends', desc: 'Only friends can watch' },
  { value: 'ONLY_ME', label: 'Only me', desc: 'Private test stream' },
];

export default function CreateLiveModal({ open, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showVisibility, setShowVisibility] = useState(false);

  if (!open) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const result = await liveService.create({ title, description, visibility });
      onCreated?.(result.live);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create live stream');
    } finally {
      setLoading(false);
    }
  };

  const selectedVis = VISIBILITY_OPTIONS.find((o) => o.value === visibility);

  return (
    <div className="clm-backdrop" onClick={onClose}>
      <div className="clm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="clm-header">
          <h2>Create Live Video</h2>
          <button className="clm-close" onClick={onClose}>
            <Icon name="more" size={20} />
          </button>
        </div>

        <form className="clm-body" onSubmit={handleCreate}>
          <div className="clm-preview">
            <div className="clm-preview-icon">
              <Icon name="video" size={48} />
            </div>
            <p>Your camera preview will appear here</p>
          </div>

          <div className="clm-field">
            <label>Title</label>
            <input
              type="text"
              placeholder="Add a title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="clm-field">
            <label>Description (optional)</label>
            <textarea
              placeholder="What's your live video about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>

          <div className="clm-field">
            <label>Visibility</label>
            <div className="clm-visibility-select" onClick={() => setShowVisibility(!showVisibility)}>
              <Icon name="users" size={16} />
              <span>{selectedVis?.label}</span>
              <Icon name="chevron_down" size={14} />
            </div>
            {showVisibility && (
              <div className="clm-visibility-dropdown">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`clm-visibility-option ${visibility === opt.value ? 'active' : ''}`}
                    onClick={() => {
                      setVisibility(opt.value);
                      setShowVisibility(false);
                    }}
                  >
                    <span className="clm-vis-label">{opt.label}</span>
                    <span className="clm-vis-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <div className="clm-error">{error}</div>}

          <div className="clm-footer">
            <button type="button" className="clm-btn clm-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="clm-btn clm-btn-create"
              disabled={loading || !title.trim()}
            >
              {loading ? 'Creating...' : 'Go Live'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
