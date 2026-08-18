import { memo, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, useAuthData } from '../../context/AuthContext.jsx';
import Icon from '../common/Icon.jsx';
import UserAvatar from '../common/UserAvatar.jsx';
import Logo from './Logo.jsx';
import SearchDropdown from './SearchDropdown.jsx';
import MenuDropdown from './MenuDropdown.jsx';
import MessengerDropdown from './MessengerDropdown.jsx';
import NotificationDropdown from './NotificationDropdown.jsx';
import ProfileDropdown from './ProfileDropdown.jsx';
import { NAV_TABS } from '../../constants/index.js';

// Lightweight dropdown shell — used for Menu/Messenger/Notifications/Profile
// buttons in the navbar. Wraps a trigger element with positioning so the
// dropdown panel hangs below the circle button. Click-outside / Escape close.
function NavDropdown({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`nav-dropdown${open ? ' open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`circle-btn${open ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        ref={ref}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`nav-dropdown-panel nav-dropdown-${align}`}
          role="menu"
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}

function CenterTab({ tab, active }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={tab.path}
      className={`topbar-tab${active ? ' active' : ''}`}
      aria-label={tab.label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="topbar-tab-icon">
        <Icon
          name={active ? tab.filled : tab.outline}
          size={28}
          viewBox="0 0 28 28"
        />
      </span>
      {hover && !active && <span className="topbar-tab-tooltip">{tab.label}</span>}
    </Link>
  );
}

function Navbar({ onMenuToggle }) {
  const { user } = useAuth();
  const { unreadNotifications } = useAuthData();
  const location = useLocation();

  if (!user) return null;

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/home';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="topbar" role="banner">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Icon name="menu" size={22} />
        </button>

        <Link to="/" className="topbar-logo" aria-label="Home">
          <Logo size={36} />
        </Link>

        <SearchDropdown />
      </div>

      <nav className="topbar-center" aria-label="Primary">
        {NAV_TABS.map((tab) => (
          <CenterTab key={tab.path} tab={tab} active={isActive(tab.path)} />
        ))}
      </nav>

      <div className="topbar-right">
        <NavDropdown
          align="right"
          trigger={
            <>
              <Icon name="more" size={20} />
              <span className="sr-only">Menu</span>
            </>
          }
        >
          {({ close }) => <MenuDropdown onClose={close} />}
        </NavDropdown>

        <NavDropdown
          align="right"
          trigger={
            <>
              <Icon name="messenger" size={20} />
              <span className="sr-only">Messenger</span>
            </>
          }
        >
          {({ close }) => <MessengerDropdown onClose={close} />}
        </NavDropdown>

        <NavDropdown
          align="right"
          trigger={
            <>
              <Icon name="bell" size={20} />
              {unreadNotifications > 0 && (
                <span key={unreadNotifications} className="badge-count">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </>
          }
        >
          {({ close }) => <NotificationDropdown onClose={close} />}
        </NavDropdown>

        <NavDropdown
          align="right"
          trigger={<UserAvatar user={user} size="md" />}
        >
          {({ close }) => <ProfileDropdown onClose={close} />}
        </NavDropdown>
      </div>
    </header>
  );
}

export default memo(Navbar);
