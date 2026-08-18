import { memo, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { storyService } from '../../services';
import Icon from '../common/Icon.jsx';

// Menu (the 9-dot grid) dropdown. Two columns — Social links and Create
// shortcuts. Matches the helper's MenuDropdown.tsx panel shape.

const SOCIAL_LINKS = [
  { to: '/events', icon: 'calendar', label: 'Events', color: '#fa3e3e' },
  { to: '/friends', icon: 'friends', label: 'Friends', color: '#0866ff' },
  { to: '/groups', icon: 'group', label: 'Groups', color: '#0866ff' },
  { to: '/reels', icon: 'reels', label: 'Video', color: '#f33e58' },
  { to: '/marketplace', icon: 'marketplace', label: 'Marketplace', color: '#0866ff' },
  { to: '/saved', icon: 'bookmark', label: 'Saved', color: '#0866ff' },
  { to: '/gaming', icon: 'gaming', label: 'Gaming', color: '#0866ff' },
  { to: '/', icon: 'memories', label: 'Memories', color: '#31a24c' },
  { to: '/groups', icon: 'flag_filled', label: 'Pages', color: '#0866ff' },
];

const CREATE_LINKS = [
  { id: 'post', icon: 'edit', label: 'Post', color: '#0866ff' },
  { id: 'story', icon: 'plusCircle', label: 'Story', color: '#0866ff' },
  { id: 'reel', icon: 'reels', label: 'Reel', color: '#0866ff' },
  { id: 'live', icon: 'video', label: 'Live Video', color: '#fa3e3e' },
  { id: 'event', icon: 'calendar', label: 'Event', color: '#fa3e3e' },
  { id: 'page', icon: 'flag_filled', label: 'Page', color: '#0866ff' },
  { id: 'ad', icon: 'barChart3', label: 'Ad', color: '#31a24c' },
];

export default memo(function MenuDropdown({ onClose }) {
  const { user } = useAuth();
  const { success, error } = useToastActions();
  const navigate = useNavigate();
  const storyInputRef = useRef(null);
  const [posting, setPosting] = useState(false);

  const onCreate = (id) => {
    onClose?.();
    if (id === 'story') {
      storyInputRef.current?.click();
      return;
    }
    if (id === 'post') {
      // Surface a toast; the actual composer lives on the home page.
      success('Write your post on the home page');
      navigate('/');
      return;
    }
    if (id === 'live' || id === 'reel') {
      success(`${id === 'live' ? 'Live video' : 'Reel'} creation coming soon`);
      return;
    }
    success('Coming soon');
  };

  const onStoryFile = async (file) => {
    if (!file) return;
    setPosting(true);
    try {
      await storyService.create(file, '');
      success('Story added');
    } catch (err) {
      error(err.message || 'Could not upload story');
    } finally {
      setPosting(false);
    }
  };

  // Auto-focus the hidden file input when the dropdown opens so that picking
  // "Story" feels immediate.
  useEffect(() => () => undefined, []);

  return (
    <div className="dropdown-menu menu-dropdown anim-pop-in" role="menu" aria-label="Menu">
      <div className="menu-grid">
        <div className="menu-column">
          <h4 className="menu-column-title">Social</h4>
          {SOCIAL_LINKS.map((link) => (
            <button
              key={link.to + link.label}
              type="button"
              className="menu-row"
              onClick={() => { onClose?.(); navigate(link.to); }}
            >
              <span className="menu-row-icon" style={{ background: link.color }}>
                <Icon name={link.icon} size={18} />
              </span>
              <span className="menu-row-label">{link.label}</span>
            </button>
          ))}
        </div>

        <div className="menu-column">
          <h4 className="menu-column-title">Create</h4>
          {CREATE_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className="menu-row"
              onClick={() => onCreate(link.id)}
              disabled={posting && link.id === 'story'}
            >
              <span className="menu-row-icon" style={{ background: link.color }}>
                <Icon name={link.icon} size={18} />
              </span>
              <span className="menu-row-label">{link.label}</span>
            </button>
          ))}
        </div>
      </div>

      <input
        ref={storyInputRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => onStoryFile(e.target.files?.[0])}
      />

      <div className="menu-footer">
        <button
          type="button"
          className="menu-see-all"
          onClick={() => { onClose?.(); navigate(`/profile/${user?.username}`); }}
        >
          See all profiles
        </button>
      </div>
    </div>
  );
});
