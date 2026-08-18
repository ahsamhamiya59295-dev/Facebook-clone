import { useState, useEffect, useCallback } from 'react';

import { savedService } from '../../services';
import { useToastActions } from '../../context/ToastContext.jsx';
import Icon from '../../components/common/Icon.jsx';
import Modal from '../../components/common/Modal.jsx';
import PostCard from '../../components/post/PostCard.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';

export default function SavedPage() {
  const { success, error } = useToastActions();
  const [posts, setPosts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [filter, setFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await savedService.all();
      setPosts(data.posts || []);
      setCollections(data.collections || []);
    } catch (err) {
      error(err.message);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => { load(); }, [load]);

  const createCollection = async () => {
    if (!name.trim()) return;
    try {
      await savedService.createCollection(name.trim());
      success('Collection created');
      setName('');
      setCreateOpen(false);
      load();
    } catch (err) {
      error(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="page-header">
        <h1>Saved</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={14} /> New Collection
        </button>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${!filter ? 'active' : ''}`} onClick={() => setFilter(null)}>All</button>
        {collections.map((c) => (
          <button key={c.id} className={`tab-btn ${filter === c.id ? 'active' : ''}`} onClick={() => setFilter(c.id)}>{c.name}</button>
        ))}
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="spinner" /></div>
      ) : posts.length === 0 ? (
        <EmptyState icon="bookmark" title="Nothing saved yet" subtitle="Save posts you want to come back to." />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onPostDelete={() => load()} />)
      )}

      {createOpen && (
        <Modal
          title="Create Collection"
          onClose={() => setCreateOpen(false)}
          footer={<button className="btn btn-primary btn-block" onClick={createCollection}>Create</button>}
        >
          <div className="form-group">
            <label className="form-label">Collection name</label>
            <input className="form-input" placeholder="e.g. Recipes" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  );
}