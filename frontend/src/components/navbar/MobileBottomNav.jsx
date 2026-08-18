import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import { NAV_TABS } from '../../constants/index.js';

export default memo(function MobileBottomNav() {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/home';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {NAV_TABS.map((tab) => (
        <Link
          key={tab.path}
          to={tab.path}
          className={`nav-item ${isActive(tab.path) ? 'active' : ''}`}
          aria-label={tab.label}
        >
          <Icon name={isActive(tab.path) ? tab.filled : tab.outline} viewBox="0 0 28 28" />
        </Link>
      ))}
    </nav>
  );
});