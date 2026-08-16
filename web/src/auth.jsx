import { createContext, useCallback, useEffect, useState } from 'react';
import api from './api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ token: null, user: null, loading: true });

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const userJson = sessionStorage.getItem('user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        setAuth({ token, user, loading: false });
        return;
      } catch {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
      }
    }
    setAuth({ token: null, user: null, loading: false });
  }, []);

  const login = useCallback(async (username, password, admin = false) => {
    const endpoint = admin ? '/api/auth/admin-login' : '/api/auth/login';
    const { data } = await api.post(endpoint, { username, password });
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    setAuth({ token: data.token, user: data.user, loading: false });
    return data.user;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setAuth({ token: null, user: null, loading: false });
  }, []);

  const isAuthenticated = !!auth.token;
  const isAdmin = auth.user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        isAuthenticated,
        isAdmin,
        login,
        logout
      }}
    >
      {!auth.loading && children}
    </AuthContext.Provider>
  );
}
