import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import Icon from '../common/Icon.jsx';

// Profile (avatar) dropdown for the navbar — mirrors the helper's
// ProfileDropdown.tsx layout: profile card, "See all profiles" link, Settings /
// Help / Display & accessibility (with theme toggle) / Give feedback / Log Out,
// plus the footer microcopy.
function ProfileDropdown({ onClose }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  if (!user) return null;

  const go = (path) => () => { onClose?.(); navigate(path); };
  const handleLogout = async () => {
    onClose?.();
    await logout();
    navigate('/login');
  };

  return (
    <div className="dropdown-menu profile-dropdown anim-pop-in" role="menu" aria-label="Account menu">
      <button type="button" className="profile-card" onClick={go(`/profile/${user.username}`)}>
        <UserAvatar user={user} size="lg" />
        <span className="profile-card-text">
          <span className="profile-card-name">{user.fullName}</span>
          <span className="profile-card-sub">View your profile</span>
        </span>
      </button>

      <div className="profile-see-all">
        <button type="button" className="profile-see-all-btn" onClick={go(`/profile/${user.username}`)}>
          See all profiles
        </button>
      </div>

      <hr className="profile-divider" />

      <ul className="profile-list">
        <li>
          <button type="button" className="profile-row" onClick={go('/settings')}>
            <span className="profile-row-icon"><Icon name="cog" size={18} /></span>
            <span>Settings</span>
          </button>
        </li>
        <li>
          <button type="button" className="profile-row" onClick={go('/help')}>
            <span className="profile-row-icon"><Icon name="helpCircle" size={18} /></span>
            <span>Help</span>
          </button>
        </li>
        <li>
          <button type="button" className="profile-row profile-row-toggle" onClick={toggle} aria-pressed={theme === 'dark'}>
            <span className="profile-row-icon">
              <Icon name="moon" size={18} />
            </span>
            <span className="profile-row-label">Display &amp; accessibility</span>
            <span className="profile-row-toggle-value">
              <span className="profile-row-toggle-pill" data-on={theme === 'dark'} aria-hidden="true">
                <span className="profile-row-toggle-knob" />
              </span>
              <span className="profile-row-toggle-text">{theme === 'dark' ? 'On' : 'Off'}</span>
            </span>
          </button>
        </li>
        <li>
          <button type="button" className="profile-row" onClick={() => { onClose?.(); window.open('https://www.facebook.com/help/', '_blank', 'noopener'); }}>
            <span className="profile-row-icon"><Icon name="messageSquareHeart" size={18} /></span>
            <span>Give feedback</span>
          </button>
        </li>
      </ul>

      <hr className="profile-divider" />

      <button type="button" className="profile-row profile-row-danger" onClick={handleLogout}>
        <span className="profile-row-icon"><Icon name="logout" size={18} /></span>
        <span>Log Out</span>
      </button>

      <div className="profile-footer">
        <span>Privacy</span>
        <span className="profile-footer-dot">·</span>
        <span>Terms</span>
        <span className="profile-footer-dot">·</span>
        <span>Advertising</span>
        <span className="profile-footer-dot">·</span>
        <span>Cookies</span>
        <span className="profile-footer-dot">·</span>
        <span>Meta © 2026</span>
      </div>
    </div>
  );
}

export default memo(ProfileDropdown);
