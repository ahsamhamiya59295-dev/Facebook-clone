import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { marketplaceService } from '../../services';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';
import { formatPrice } from '../../utils/format.js';

export default function MarketplaceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { success, error } = useToastActions();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketplaceService.get(id);
      setListing(data.listing);
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, error]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="page-container"><div className="loader-wrap"><div className="spinner" /></div></div>;

  if (!listing) {
    return (
      <div className="page-container">
        <div className="card p-4">
          <h2>Listing not found</h2>
          <Link to="/marketplace" className="btn btn-primary" style={{ marginTop: 12 }}>Back to Marketplace</Link>
        </div>
      </div>
    );
  }

  const isOwner = user && listing.sellerId === user.id;

  const del = async () => {
    if (!window.confirm('Delete this listing?')) return;
    try {
      await marketplaceService.remove(listing.id);
      success('Listing deleted');
      navigate('/marketplace');
    } catch (err) {
      error(err.message);
    }
  };

  return (
    <div className="page-container">
      <Link to="/marketplace" className="text-link" style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon name="arrow_back" size={16} /> Back to Marketplace
      </Link>
      <div className="listing-detail">
        <div className="listing-detail-images">
          {listing.images?.length ? (
            <>
              <img src={listing.images[activeImg]} alt={listing.title} className="listing-detail-main" loading="lazy" decoding="async" />
              {listing.images.length > 1 && (
                <div className="listing-thumbs">
                  {listing.images.map((src, i) => (
                    <img key={i} src={src} alt="" className={`listing-thumb ${i === activeImg ? 'active' : ''}`} onClick={() => setActiveImg(i)} loading="lazy" decoding="async" />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ height: 300, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={48} /></div>
          )}
        </div>
        <div className="listing-detail-info">
          <h1 className="listing-detail-title">{listing.title}</h1>
          <div className="listing-price h1">{formatPrice(listing.price, listing.currency)}</div>
          {listing.condition && <div className="text-muted text-sm">Condition: {listing.condition}</div>}
          {listing.location && <div className="text-muted text-sm"><Icon name="location_on" size={14} /> {listing.location}</div>}
          <div className="text-muted text-sm">Category: {listing.category} · {listing.status.toLowerCase()}</div>
          {listing.description && (
            <div className="listing-detail-desc">
              <h3>Description</h3>
              <p className="text-muted">{listing.description}</p>
            </div>
          )}
          <div className="seller-card">
            <UserAvatar user={listing.seller} size="lg" />
            <div>
              <div className="user-name">{listing.seller.fullName}</div>
              <div className="user-sub">@{listing.seller.username}</div>
            </div>
          </div>
          {isOwner ? (
            <div className="btn-row" style={{ gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => navigate('/marketplace')}>Edit later</button>
              <button className="btn btn-danger" onClick={del}>Delete</button>
            </div>
          ) : listing.seller && (
            <Link to={`/profile/${listing.seller.username}`} className="btn btn-primary btn-block">View seller profile</Link>
          )}
        </div>
      </div>
    </div>
  );
}