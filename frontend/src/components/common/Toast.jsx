import { useToast } from '../../context/ToastContext.jsx';
import Icon from './Icon.jsx';

export function ToastContainer() {
  const { toasts } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <Icon name={t.type === 'error' ? 'report' : t.type === 'info' ? 'info' : 'check'} size={16} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;