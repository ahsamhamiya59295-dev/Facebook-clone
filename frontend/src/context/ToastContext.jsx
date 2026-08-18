import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const ToastContext = createContext(null);
const ToastActionsContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const success = useCallback((m) => push(m, 'success'), [push]);
  const error = useCallback((m) => push(m, 'error'), [push]);
  const info = useCallback((m) => push(m, 'info'), [push]);

  // Actions stay referentially stable so action-only consumers (feed cards,
  // buttons, pages) never re-render when a toast appears or disappears.
  const actions = useMemo(() => ({ push, success, error, info }), [push, success, error, info]);

  return (
    <ToastActionsContext.Provider value={actions}>
      <ToastContext.Provider value={toasts}>{children}</ToastContext.Provider>
    </ToastActionsContext.Provider>
  );
}

export function useToast() {
  const actions = useContext(ToastActionsContext);
  const toasts = useContext(ToastContext);
  if (!actions || toasts === null) throw new Error('useToast must be used within ToastProvider');
  return { ...actions, toasts };
}

export function useToastActions() {
  const actions = useContext(ToastActionsContext);
  if (!actions) throw new Error('useToastActions must be used within ToastProvider');
  return actions;
}

export default ToastContext;