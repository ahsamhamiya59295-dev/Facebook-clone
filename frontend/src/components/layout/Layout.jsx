import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navbar from '../navbar/Navbar.jsx';
import SidebarLeft from '../sidebar/SidebarLeft.jsx';
import SidebarRight from '../sidebar/SidebarRight.jsx';
import MobileBottomNav from '../navbar/MobileBottomNav.jsx';
import SidebarDrawer from './SidebarDrawer.jsx';
import ToastContainer from '../common/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const FULL_LAYOUT = [
  /^\/marketplace(\/.*)?$/,
  /^\/groups(\/.*)?$/,
  /^\/friends(\/.*)?$/,
  /^\/events(\/.*)?$/,
  /^\/profile(\/.*)?$/,
];

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const isFull = FULL_LAYOUT.some((re) => re.test(location.pathname));

  return (
    <div className="layout">
      <Navbar onMenuToggle={() => setDrawerOpen(true)} />
      <ToastContainer />
      <div className={`layout-main${isFull ? '' : ' with-sidebars'}`}>
        {!isFull && <SidebarLeft />}
        <main className={`content-area${isFull ? ' full' : ''}`} id="main" role="main">
          <div className="page-anim" key={location.pathname}>
            <Outlet />
          </div>
        </main>
        {!isFull && <SidebarRight />}
      </div>
      <MobileBottomNav />
      <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}