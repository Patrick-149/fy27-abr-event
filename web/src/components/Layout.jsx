import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, isAdmin, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const showBack = location.pathname !== '/' && location.pathname !== '/admin';

  const handleLogout = () => {
    logout();
    navigate(isAdmin ? '/admin-login' : '/');
  };

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-brand text-white shadow">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to={isAdmin ? '/admin' : '/'} className="font-bold text-lg">
            FY27 ABR
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {user && (
              <span className="hidden sm:inline">
                {user.name} {isAdmin && '(Admin)'}
              </span>
            )}
            {isAuthenticated && (
              <button onClick={handleLogout} className="underline">
                Logout
              </button>
            )}
          </div>
        </div>
      </header>
      {showBack && (
        <div className="max-w-3xl mx-auto px-4 pt-3 w-full">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-brand hover:underline"
          >
            &larr; Back
          </button>
        </div>
      )}
      <main className="flex-1 max-w-3xl mx-auto px-4 py-4 w-full">
        <Outlet />
      </main>
    </div>
  );
}
