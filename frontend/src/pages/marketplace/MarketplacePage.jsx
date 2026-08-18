import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { marketplaceService } from '../../services';
import { useToastActions } from '../../context/ToastContext.jsx';
import Icon from '../../components/common/Icon.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { CATEGORIES } from '../../constants';
import { formatPrice } from '../../utils/format.js';

export default function MarketplacePage() {
  const { success, error } = useToastActions();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', price: '', category: 'Electronics', condition: 'New', location: '' });
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketplaceService.all({ category: category || undefined });
      setListings(data.listings || []);
    } catch (err) {
      error(err.message);
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [category, error]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title.trim() || !form.price || !form.category) {
      error('Title, price and category are required');
      return;
    }
    setSubmitting(true);
    try {
      await marketplaceService.create({ ...form, price: parseFloat(form.price) }, files);
      success('Listing created');
      setCreateOpen(false);
      setForm({ title: '', description: '', price: '', category: 'Electronics', condition: 'New', location: '' });
      setFiles([]);
      load();
    } catch (err) {
      error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-view">
      <aside className="app-rail" aria-label="Marketplace categories">
        <div className="rail-header">
          <h2>Marketplace</h2>
          <button className="circle-btn" aria-label="Search marketplace" style={{ flexShrink: 0 }}>
            <Icon name="search" />
          </button>
        </div>
        <div className="rail-search">
          <Icon name="search" />
          <input placeholder="Search Marketplace" aria-label="Search Marketplace" />
        </div>
        <div className="rail-item blue" onClick={() => setCategory('')} role="button" tabIndex={0}>
          <span className="rail-icon"><Icon name="store" /></span>
          <span>Browse all</span>
        </div>
        {CATEGORIES.map((c) => (
          <div key={c} className={`rail-item ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)} role="button" tabIndex={0}>
            <span className="rail-icon"><Icon name="tag" size={18} /></span>
            <span>{c}</span>
          </div>
        ))}
        <div className="rail-divider" />
        <button className="rail-create" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" /> Sell something
        </button>
      </aside>

      <div className="app-content wide">
        <div className="section-card" style={{ marginBottom: 12 }}>
          <div className="section-head">
            <h2 className="section-title">{category || 'Today'}{category ? '' : "'s picks"}</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
              <Icon name="plus" size={14} /> Create Listing
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loader-wrap"><div className="spinner" /></div>
        ) : listings.length === 0 ? (
          <EmptyState icon="store" title="No listings" subtitle="Be the first to create a listing in this category." />
        ) : (
          <div className="marketplace-grid">
            {listings.map((l) => (
              <Link key={l.id} to={`/marketplace/${l.id}`} className="listing-card" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
                {l.images?.[0] ? <img src={l.images[0]} alt={l.title} loading="lazy" /> : <div style={{ height: 200, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={40} /></div>}
                <div className="listing-card-body">
                  <div className="listing-price">{formatPrice(l.price, l.currency)}</div>
                  <div className="listing-title ellipsis">{l.title}</div>
                  {l.location && <div className="listing-location">{l.location}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <Modal
          title="Create Listing"
          onClose={() => setCreateOpen(false)}
          footer={<button className="btn btn-primary btn-block" onClick={create} disabled={submitting}>{submitting ? 'Creating...' : 'Publish Listing'}</button>}
        >
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Price</label>
            <input className="form-input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Condition</label>
            <select className="form-select" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
              {['New', 'Like New', 'Good', 'Fair', 'Poor'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, State" />
          </div>
          <div className="form-group">
            <label className="form-label">Photos</label>
            <input className="form-input" type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files))} />
            {files.length > 0 && <p className="form-hint">{files.length} photo(s) selected</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}