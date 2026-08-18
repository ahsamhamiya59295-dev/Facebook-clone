import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { authService, notificationService, safetyService, userService } from '../../services';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';

const TABS = [
  { id: 'general', label: 'General', icon: 'users_single' },
  { id: 'profile', label: 'Profile', icon: 'edit' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'privacy', label: 'Privacy & Blocking', icon: 'lock' },
  { id: 'security', label: 'Security', icon: 'shield' },
];

export default function SettingsPage() {
  const { user, updateUser, apiError } = useAuth();
  const { success, error } = useToastActions();
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState('general');
  const [notifSettings, setNotifSettings] = useState({});
  const [blocked, setBlocked] = useState([]);
  const [privacy, setPrivacy] = useState('PUBLIC');
  const [profileForm, setProfileForm] = useState({ fullName: user.fullName, username: user.username, bio: user.bio || '', location: user.location || '' });
  const [saving, setSaving] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '' });
  const [changingPwd, setChangingPwd] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ns, bl] = await Promise.all([notificationService.settings(), safetyService.blocked()]);
      setNotifSettings(ns.settings || {});
      setBlocked(bl.blockedUsers || []);
      setPrivacy(user.profile?.privacy || 'PUBLIC');
    } catch (err) {
      // ignore
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggleNotif = async (key) => {
    const next = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(next);
    try {
      await notificationService.updateSettings(next);
    } catch (err) {
      error(err.message);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const data = await userService.updateMe({ ...profileForm, profile: { bio: profileForm.bio } });
      updateUser(data.user);
      success('Profile saved');
    } catch (err) {
      error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const changePrivacy = async (p) => {
    setPrivacy(p);
    try {
      await userService.updateMe({ profile: { privacy: p } });
      success('Privacy updated');
    } catch (err) {
      error(err.message);
    }
  };

  const unblock = async (id) => {
    try {
      await safetyService.unblock(id);
      setBlocked((b) => b.filter((x) => x.id !== id));
      success('User unblocked');
    } catch (err) {
      error(err.message);
    }
  };

  const changePassword = async () => {
    setChangingPwd(true);
    try {
      await authService.changePassword(pwdForm.currentPassword, pwdForm.newPassword);
      setPwdForm({ currentPassword: '', newPassword: '' });
      success('Password updated. Please log in again.');
    } catch (err) {
      error(err.message);
    } finally {
      setChangingPwd(false);
    }
  };

  const notifKeys = [
    ['likesEnabled', 'Likes on my posts'],
    ['commentsEnabled', 'Comments and replies'],
    ['friendRequestsEnabled', 'Friend requests'],
    ['followsEnabled', 'New followers'],
    ['messagesEnabled', 'Messages'],
    ['storiesEnabled', 'Stories'],
  ];

  return (
    <div className="settings-layout">
      <nav className="settings-nav">
        {TABS.map((t) => (
          <button key={t.id} className={`settings-nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
              <Icon name={t.icon} size={18} /> {t.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="settings-panel">
        {tab === 'general' && (
          <div>
            <h2>General</h2>
            <div className="settings-section">
              <h3>Account</h3>
              <p className="text-sm text-muted">Signed in as <strong>{user.email}</strong></p>
              <p className="text-sm text-muted">Member since {new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="settings-section">
              <h3>Display &amp; accessibility</h3>
              <div className="switch-row">
                <label htmlFor="dark-mode-toggle">Dark mode</label>
                <span className="switch">
                  <input
                    id="dark-mode-toggle"
                    type="checkbox"
                    checked={theme === 'dark'}
                    onChange={toggle}
                  />
                  <label htmlFor="dark-mode-toggle" className="track" />
                </span>
              </div>
              <p className="text-sm text-muted">
                Switch between dark and light themes. Your choice is saved to this browser.
              </p>
            </div>
            <div className="settings-section">
              <h3>Privacy of future posts</h3>
              <select className="form-select" value={privacy} onChange={(e) => changePrivacy(e.target.value)}>
                <option value="PUBLIC">Public</option>
                <option value="FRIENDS">Friends</option>
                <option value="ONLY_ME">Only Me</option>
              </select>
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div>
            <h2>Edit Profile</h2>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input className="form-input" value={profileForm.fullName} onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className="form-input" value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Bio</label>
              <textarea className="form-textarea" value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} />
            </div>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        )}

        {tab === 'notifications' && (
          <div>
            <h2>Notification Settings</h2>
            <div className="settings-switches">
              {notifKeys.map(([key, label]) => (
                <div className="switch-row" key={key}>
                  <label>{label}</label>
                  <span className="switch">
                    <input type="checkbox" checked={Boolean(notifSettings[key])} onChange={() => toggleNotif(key)} id={key} />
                    <label htmlFor={key} className="track" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'privacy' && (
          <div>
            <h2>Privacy & Blocking</h2>
            <div className="settings-section">
              <h3>Blocked Users</h3>
              {blocked.length === 0 ? (
                <p className="text-sm text-muted">No blocked users.</p>
              ) : (
                blocked.map((b) => (
                  <div key={b.id} className="user-row" style={{ padding: '8px 0' }}>
                    <UserAvatar user={b} size="md" />
                    <div className="flex-grow">
                      <div className="user-name">{b.fullName}</div>
                      <div className="user-sub">@{b.username}</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => unblock(b.id)}>Unblock</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'security' && (
          <div>
            <h2>Security</h2>
            <div className="settings-section">
              <h3>Change password</h3>
              <div className="form-group">
                <label className="form-label">Current password</label>
                <input className="form-input" type="password" value={pwdForm.currentPassword} onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">New password</label>
                <input className="form-input" type="password" value={pwdForm.newPassword} onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })} />
              </div>
              <button className="btn btn-primary" onClick={changePassword} disabled={changingPwd || !pwdForm.currentPassword || !pwdForm.newPassword}>
                {changingPwd ? 'Updating...' : 'Update password'}
              </button>
            </div>
            <div className="settings-section">
              <h3>Account</h3>
              <p className="text-sm text-muted">Your account is protected with a secure password.</p>
              <ul className="text-sm text-muted" style={{ paddingLeft: 20 }}>
                <li>Passwords are hashed with bcrypt</li>
                <li>Sessions use HTTP-only cookies with CSRF protection</li>
                <li>Session expiry: 7 days</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}