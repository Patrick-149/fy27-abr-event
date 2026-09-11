import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AdminRoute() {
  const { isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  console.log('AdminRoute check:', { isAuthenticated, isAdmin, path: location.pathname });

  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/admin-login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    console.log('Not admin, redirecting to login');
    return <Navigate to="/admin-login" state={{ from: location, error: 'Not authorized' }} replace />;
  }

  console.log('Admin authenticated, rendering outlet');
  return <Outlet />;
}
