import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { authService, notificationService, userService } from '../services';

const AuthContext = createContext(null);
const AuthDataContext = createContext(null);

const SESSION_KEY = 'fb_clone_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [friends, setFriends] = useState([]);
  const [requestsCount, setRequestsCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadAuth = useCallback(async () => {
    // Skip the /me round-trip entirely when no session was ever established
    // (avoids a 401 console error on every auth-page load).
    if (!localStorage.getItem(SESSION_KEY)) {
      setUser(null);
      setLoading(false);
      setInitialized(true);
      return;
    }
    try {
      const { user } = await authService.me();
      setUser(user);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await notificationService.all(1);
      setNotifications(data.notifications || []);
      setUnreadNotifications(data.unread || 0);
    } catch (err) {
      // ignore
    }
  }, []);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    try {
      const data = await userService.friends(user.id);
      setFriends(data.friends || []);
      const req = await userService.requests();
      setRequestsCount(req.requests?.length || 0);
    } catch (err) {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    if (user) {
      loadNotifications();
      loadFriends();
    }
  }, [user, loadNotifications, loadFriends]);

  const login = useCallback(async (data) => {
    const { user } = await authService.login(data);
    localStorage.setItem(SESSION_KEY, '1');
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (data) => {
    const { user } = await authService.register(data);
    localStorage.setItem(SESSION_KEY, '1');
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (err) {
      // ignore
    }
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setFriends([]);
    setNotifications([]);
    setUnreadNotifications(0);
    setRequestsCount(0);
  }, []);

  const updateUser = useCallback((fields) => {
    setUser((u) => (u ? { ...u, ...fields } : u));
  }, []);

  const apiError = useCallback((err) => err?.message || 'Something went wrong', []);

  // Auth (user + stable actions) and Data (frequently-updated collections) are
  // kept in separate contexts so that notification/friend updates do not
  // re-render the entire app tree (feed cards, sidebars, navbar, etc.).
  const authValue = useMemo(
    () => ({
      user,
      setUser,
      loading,
      initialized,
      login,
      register,
      logout,
      updateUser,
      loadAuth,
      loadNotifications,
      loadFriends,
      apiError,
      api,
    }),
    [
      user,
      setUser,
      loading,
      initialized,
      login,
      register,
      logout,
      updateUser,
      loadAuth,
      loadNotifications,
      loadFriends,
      apiError,
    ]
  );

  const dataValue = useMemo(
    () => ({
      friends,
      setFriends,
      requestsCount,
      notifications,
      setNotifications,
      unreadNotifications,
      setUnreadNotifications,
    }),
    [
      friends,
      setFriends,
      requestsCount,
      notifications,
      setNotifications,
      unreadNotifications,
      setUnreadNotifications,
    ]
  );

  return (
    <AuthContext.Provider value={authValue}>
      <AuthDataContext.Provider value={dataValue}>{children}</AuthDataContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useAuthData() {
  const ctx = useContext(AuthDataContext);
  if (!ctx) throw new Error('useAuthData must be used within AuthProvider');
  return ctx;
}

export default AuthContext;