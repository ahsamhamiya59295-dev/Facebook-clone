import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ identifier, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-split">
        <div className="auth-left">
          <div className="auth-logo">facebook</div>
          <p className="auth-tagline">Facebook helps you connect and share with the people in your life.</p>
        </div>
        <div className="auth-card">
          {error && <div key={error} className="auth-error" role="alert">{error}</div>}
          <form onSubmit={submit}>
            <input
              className="form-input"
              type="text"
              placeholder="Email or phone number"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
            />
            <input
              className="form-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" className="btn-login" disabled={loading}>
              {loading && <span className="btn-spinner" aria-hidden="true" />}
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
          <Link to="/forgot-password" className="auth-forgot">Forgotten password?</Link>
          <div className="auth-divider"><span>or</span></div>
          <Link to="/register" className="btn-signup">Create new account</Link>
        </div>
      </div>
    </div>
  );
}