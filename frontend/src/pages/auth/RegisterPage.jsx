import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const FIELDS = { first: '', last: '', username: '', email: '', password: '', confirm: '', dob: '', gender: '' };

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(FIELDS);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    if (form.password !== form.confirm) return 'Passwords do not match';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (form.gender === '') return 'Select a gender';
    if (new Date(form.dob) > new Date(Date.now() - 13 * 365 * 24 * 3600 * 1000)) return 'You must be at least 13 years old';
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    setError(err);
    if (err) return;
    setLoading(true);
    try {
      await register({
        fullName: `${form.first} ${form.last}`.trim(),
        username: form.username,
        email: form.email,
        password: form.password,
        dob: form.dob,
        gender: form.gender,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card auth-register-card">
        <h2 className="auth-card-title">Sign Up</h2>
        <p className="auth-subtitle">It&apos;s quick and easy.</p>
        {error && <div key={error} className="auth-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <div className="auth-name-grid">
            <input className="form-input" placeholder="First name" value={form.first} onChange={set('first')} required autoFocus />
            <input className="form-input" placeholder="Last name" value={form.last} onChange={set('last')} required />
          </div>
          <input className="form-input" placeholder="Username" value={form.username} onChange={set('username')} required />
          <input className="form-input" type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
          <div className="auth-name-grid">
            <input className="form-input" type="password" placeholder="New password" value={form.password} onChange={set('password')} required />
            <input className="form-input" type="password" placeholder="Confirm password" value={form.confirm} onChange={set('confirm')} required />
          </div>
          <div className="form-group" style={{ margin: '12px 0 0' }}>
            <label className="auth-label" htmlFor="dob">Date of birth</label>
            <input className="form-input" type="date" id="dob" value={form.dob} onChange={set('dob')} required />
          </div>
          <div className="form-group" style={{ margin: '4px 0 0' }}>
            <span className="auth-label d-block">Gender</span>
            <div className="auth-row">
              <label className="auth-radio">
                Female
                <input type="radio" name="gender" value="FEMALE" checked={form.gender === 'FEMALE'} onChange={set('gender')} />
              </label>
              <label className="auth-radio">
                Male
                <input type="radio" name="gender" value="MALE" checked={form.gender === 'MALE'} onChange={set('gender')} />
              </label>
              <label className="auth-radio">
                Other
                <input type="radio" name="gender" value="OTHER" checked={form.gender === 'OTHER'} onChange={set('gender')} />
              </label>
            </div>
          </div>
          <button type="submit" className="btn-signup" disabled={loading}>
            {loading && <span className="btn-spinner" aria-hidden="true" />}
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>
        <div className="auth-form-footer">
          Already have an account? <Link to="/login" className="text-link">Log in</Link>
        </div>
      </div>
    </div>
  );
}