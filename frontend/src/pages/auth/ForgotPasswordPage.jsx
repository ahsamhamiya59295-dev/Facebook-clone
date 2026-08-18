import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [showReset, setShowReset] = useState(!!searchParams.get('token'));
  const redirectTimer = useRef(null);

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  const requestReset = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const data = await authService.forgotPassword(email);
      setInfo(data.message || 'If an account with that email exists, a password reset token was generated.');
      if (data.resetToken) {
        setToken(data.resetToken);
        setShowReset(true);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const doReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setInfo('Password updated. You can now log in.');
      redirectTimer.current = setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.message || 'Reset failed');
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
          {info && <div className="auth-info">{info}</div>}
          {!showReset ? (
            <form onSubmit={requestReset}>
              <h2 className="auth-title">Find your account</h2>
              <p className="text-sm text-muted" style={{ marginBottom: 12 }}>Enter your email address. Your reset token will be shown on screen.</p>
              <input
                className="form-input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <button type="submit" className="btn-login" disabled={loading}>
                {loading && <span className="btn-spinner" aria-hidden="true" />}
                {loading ? 'Sending...' : 'Send reset token'}
              </button>
            </form>
          ) : (
            <form onSubmit={doReset}>
              <h2 className="auth-title">Choose a new password</h2>
              {token && (
                <div className="auth-info auth-token-box">
                  <span className="auth-token-label">Your reset token</span>
                  <code className="auth-token-value">{token}</code>
                  <button type="button" className="auth-token-copy" onClick={() => navigator.clipboard?.writeText(token)}>
                    Copy
                  </button>
                </div>
              )}
              <input
                className="form-input"
                type="text"
                placeholder="Reset token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
              <input
                className="form-input"
                type="password"
                placeholder="New password (8+ chars, letter + number)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" className="btn-login" disabled={loading}>
                {loading && <span className="btn-spinner" aria-hidden="true" />}
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          )}
          {!showReset && (
            <button type="button" className="btn-login btn-secondary" style={{ marginTop: 10 }} onClick={() => setShowReset(true)}>
              Already have a reset token?
            </button>
          )}
          <div className="auth-divider"><span>or</span></div>
          <Link to="/login" className="btn-signup">Back to login</Link>
        </div>
      </div>
    </div>
  );
}