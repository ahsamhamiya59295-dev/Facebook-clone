import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupService } from '../../services';
import { useToastActions } from '../../context/ToastContext.jsx';
import Icon from '../../components/common/Icon.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { GROUP_PRIVACY } from '../../constants';

export default function GroupsPage() {
  const navigate = useNavigate();
  const { success, error } = useToastActions();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', privacy: 'PRIVATE' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await groupService.all();
      setGroups(data.groups || []);
    } catch (err) {
      error(err.message);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name.trim()) {
      error('Group name is required');
      return;
    }
    try {
      const data = await groupService.create(form);
      success('Group created');
      setCreateOpen(false);
      setForm({ name: '', description: '', privacy: 'PRIVATE' });
      navigate(`/groups/${data.group.id}`);
    } catch (err) {
      error(err.message);
    }
  };

  return (
    <div className="app-view">
      <aside className="app-rail" aria-label="Groups navigation">
        <div className="rail-header">
          <h2>Groups</h2>
          <button className="circle-btn" aria-label="Search groups" style={{ flexShrink: 0 }}>
            <Icon name="search" />
          </button>
        </div>
        <div className="rail-item blue">
          <span className="rail-icon"><Icon name="group" /></span>
          <span>Your feed</span>
        </div>
        <div className="rail-item">
          <span className="rail-icon"><Icon name="compass" /></span>
          <span>Discover</span>
        </div>
        <button className="rail-create" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" /> Create new group
        </button>

        {groups.length > 0 && (
          <>
            <div className="rail-divider" />
            <div className="rail-title">Groups you&apos;ve joined</div>
            {groups.map((g) => (
              <div key={g.id} className="rail-item" onClick={() => navigate(`/groups/${g.id}`)} role="button" tabIndex={0}>
                <span className="rail-icon" style={{ borderRadius: 8, background: 'transparent', color: 'var(--fb-blue)', border: '1px solid var(--divider)' }}>
                  {g.name?.[0]?.toUpperCase()}
                </span>
                <span className="ellipsis">{g.name}</span>
              </div>
            ))}
          </>
        )}
      </aside>

      <div className="app-content wide">
        <div className="section-card" style={{ marginBottom: 16 }}>
          <div className="section-head">
            <h2 className="section-title">Recent activity in your groups</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
              <Icon name="plus" size={14} /> Create Group
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loader-wrap"><div className="spinner" /></div>
        ) : groups.length === 0 ? (
          <EmptyState icon="group" title="No groups yet" subtitle="Create or join a group to get started." />
        ) : (
          <div className="group-grid">
            {groups.map((g) => (
              <div key={g.id} className="group-card" onClick={() => navigate(`/groups/${g.id}`)} role="button" tabIndex={0}>
                <div className="group-cover">
                  <span className="group-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'var(--fb-blue)' }}>
                    {g.name?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="group-card-body">
                  <h3>{g.name}</h3>
                  <p>{g.description || 'No description'}</p>
                  <div className="text-xs text-muted">
                    {g._count?.members || 0} members · {g.privacy.toLowerCase()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <Modal
          title="Create Group"
          onClose={() => setCreateOpen(false)}
          footer={<button className="btn btn-primary btn-block" onClick={create}>Create</button>}
        >
          <div className="form-group">
            <label className="form-label">Group name</label>
            <input className="form-input" placeholder="e.g. Weekend Hikers" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Privacy</label>
            <select className="form-select" value={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.value })}>
              {GROUP_PRIVACY.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}