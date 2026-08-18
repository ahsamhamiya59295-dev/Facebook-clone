import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setOnlineUsers(new Set());
      return undefined;
    }

    const token = readCookie('fb_clone_token');
    const s = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
      withCredentials: true,
      auth: {
        token,
      },
      // Bounded retries so a dead server never triggers an infinite reconnect
      // loop while the user is logged in.
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    s.on('connect', () => {
      setOnlineUsers((prev) => (prev.has(user.id) ? prev : new Set(prev).add(user.id)));
    });

    s.on('connect_error', (error) => {
      // eslint-disable-next-line no-console
      console.error('socket connection error', error.message);
      setOnlineUsers(new Set());
    });

    s.on('user:online', ({ userId }) => {
      setOnlineUsers((prev) => (prev.has(userId) ? prev : new Set(prev).add(userId)));
    });

    s.on('user:offline', ({ userId }) => {
      setOnlineUsers((prev) => {
        if (!prev.has(userId)) return prev;
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setOnlineUsers(new Set());
    };
  }, [user]);

  const value = useMemo(() => ({ socket, onlineUsers }), [socket, onlineUsers]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}

export default SocketContext;