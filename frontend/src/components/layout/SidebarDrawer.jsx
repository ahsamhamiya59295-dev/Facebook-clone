import { memo } from 'react';
import SidebarLeft from '../sidebar/SidebarLeft.jsx';

// Mobile slide-in drawer — wraps the same SidebarLeft content so mobile and
// desktop share the same data shape. Backdrop closes on click; the parent
// Layout closes the drawer on path change.
function SidebarDrawer({ open, onClose }) {
  if (!open) return null;
  return (
    <>
      <div className="sidebar-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="sidebar-drawer" aria-label="Mobile menu">
        <div className="sidebar-drawer-scroll">
          <SidebarLeft />
        </div>
      </aside>
    </>
  );
}

export default memo(SidebarDrawer);
