import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="auth-wrapper">
      <div className="auth-logo" style={{ fontSize: 80 }}>404</div>
      <p className="auth-tagline">This page isn&apos;t available right now.</p>
      <Link to="/" className="btn btn-primary">Go Home</Link>
    </div>
  );
}