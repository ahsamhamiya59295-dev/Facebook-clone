import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullScreenLoader } from '../components/common/Loader.jsx';

export function ProtectedRoute() {
  const { user, loading, initialized } = useAuth();
  const location = useLocation();

  if (loading || !initialized) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

export function GuestRoute() {
  const { user, loading, initialized } = useAuth();
  const location = useLocation();

  if (loading || !initialized) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return (
    <div className="page-anim" key={location.pathname}>
      <Outlet />
    </div>
  );
}