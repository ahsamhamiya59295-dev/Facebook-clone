import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import { adminService } from '../../services';
import UserAvatar from '../../components/common/UserAvatar.jsx';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'reports', label: 'Reports' },
];

export default function AdminPage() {
  const { user } = useAuth();
  const { success, error } = useToastActions();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await adminService.dashboard();
      setStats(data.stats);
    } catch (err) {
      error(err.message);
    }
  }, [error]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.users({ q: query || undefined });
      setUsers(data.users || []);
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, error]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.reports();
      setReports(data.reports || []);
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  }, [error]);

  const deniedNotified = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'ADMIN') {
      if (!deniedNotified.current) {
        deniedNotified.current = true;
        error('Admin access required');
      }
      return;
    }
    loadStats();
  }, [user, loadStats, error]);

  const switchTab = (t) => {
    setTab(t);
    if (t === 'users') loadUsers();
    if (t === 'reports') loadReports();
  };

  const toggleStatus = async (id) => {
    try {
      await adminService.toggleStatus(id);
      success('User status updated');
      loadUsers();
    } catch (err) {
      error(err.message);
    }
  };

  const changeRole = async (id, role) => {
    try {
      await adminService.setRole(id, role);
      success('Role updated');
      loadUsers();
    } catch (err) {
      error(err.message);
    }
  };

  const removeUser = async (id) => {
    if (!window.confirm('Delete this user permanently? This cannot be undone.')) return;
    try {
      await adminService.removeUser(id);
      success('User deleted');
      loadUsers();
      loadStats();
    } catch (err) {
      error(err.message);
    }
  };

  const resolveReport = async (id) => {
    try {
      await adminService.resolveReport(id);
      success('Report resolved');
      loadReports();
    } catch (err) {
      error(err.message);
    }
  };

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="page-container">
        <div className="card p-4 text-center">You do not have permission to view this page.</div>
      </div>
    );
  }

  const statCards = stats
    ? [
        ['Users', stats.users],
        ['Posts', stats.posts],
        ['Comments', stats.comments],
        ['Groups', stats.groups],
        ['Events', stats.events],
        ['Listings', stats.listings],
        ['Open Reports', stats.openReports],
        ['Stories', stats.stories],
      ]
    : [];

  return (
    <div className="settings-layout">
      <nav className="settings-nav">
        {TABS.map((t) => (
          <button key={t.id} className={`settings-nav-item ${tab === t.id ? 'active' : ''}`} onClick={() => switchTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="settings-panel">
        {tab === 'overview' && (
          <div>
            <h2>Admin Overview</h2>
            <div className="stats-grid">
              {statCards.map(([label, value]) => (
                <div key={label} className="card stat-card">
                  <div className="stat-value">{value ?? '—'}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div>
            <h2>User Management</h2>
            <div className="form-group" style={{ maxWidth: 320 }}>
              <input
                className="form-input"
                placeholder="Search users..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={loadUsers} disabled={loading}>
              {loading ? 'Loading...' : 'Search / Refresh'}
            </button>

            <div className="user-list">
              {users.length === 0 ? (
                <p className="text-sm text-muted">No users found.</p>
              ) : (
                users.map((u) => (
                  <div key={u.id} className="user-row" style={{ padding: '10px 0', borderBottom: '1px solid var(--bg-tertiary, #e4e6eb)' }}>
                    <UserAvatar user={u} size="md" />
                    <div className="flex-grow">
                      <div className="user-name">
                        {u.fullName} <span className="text-muted">@{u.username}</span>
                      </div>
                      <div className="user-sub">
                        {u.email} · {u._count?.posts || 0} posts · {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''}{' '}
                        · <span className={u.isActive ? '' : 'text-danger'}>{u.isActive ? 'Active' : 'Deactivated'}</span>
                      </div>
                    </div>
                    <select
                      className="form-select form-select-sm"
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      style={{ maxWidth: 120 }}
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <button className="btn btn-secondary btn-sm" onClick={() => toggleStatus(u.id)}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => removeUser(u.id)}>
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div>
            <h2>Moderation Queue</h2>
            <button className="btn btn-secondary btn-sm" onClick={loadReports} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <div className="user-list">
              {reports.length === 0 ? (
                <p className="text-sm text-muted">No reports to review.</p>
              ) : (
                reports.map((r) => (
                  <div key={r.id} className="user-row" style={{ padding: '10px 0', borderBottom: '1px solid var(--bg-tertiary, #e4e6eb)' }}>
                    <div className="flex-grow">
                      <div className="user-name">
                        {r.targetType} report by @{r.reporter?.username}
                        {r.resolved ? <span className="badge-success"> resolved</span> : <span className="badge-warn"> open</span>}
                      </div>
                      <div className="user-sub">Target: {r.targetId}</div>
                      <div className="user-sub">Reason: {r.reason}</div>
                      <div className="user-sub">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</div>
                    </div>
                    {!r.resolved && (
                      <button className="btn btn-primary btn-sm" onClick={() => resolveReport(r.id)}>
                        Resolve
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}