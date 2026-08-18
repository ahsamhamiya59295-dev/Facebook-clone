import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { eventService } from '../../services';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToastActions } from '../../context/ToastContext.jsx';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';
import { monthName, dayOfMonth, formatDate } from '../../utils/format.js';

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { success, error } = useToastActions();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberStatus, setMemberStatus] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await eventService.get(id);
      setEvent(data.event);
      setMemberStatus(data.memberStatus);
    } catch (err) {
      error(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, error]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="page-container"><div className="loader-wrap"><div className="spinner" /></div></div>;

  if (!event) {
    return (
      <div className="page-container">
        <div className="card p-4">
          <h2>Event not found</h2>
          <Link to="/events" className="btn btn-primary" style={{ marginTop: 12 }}>Back to Events</Link>
        </div>
      </div>
    );
  }

  const rsvp = async (status) => {
    try {
      await eventService.rsvp(event.id, status);
      setMemberStatus(status);
      success('RSVP updated');
    } catch (err) {
      error(err.message);
    }
  };

  const isOrganizer = user && event.organizerId === user.id;

  return (
    <div className="page-container">
      <Link to="/events" className="text-link" style={{ marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon name="arrow_back" size={16} /> Back to Events
      </Link>
      <div className="event-detail-card">
        {event.coverUrl && <img src={event.coverUrl} alt={event.name} className="event-detail-cover" loading="lazy" decoding="async" />}
        <div className="event-detail-body">
          <div className="event-date-box">
            <div className="day">{dayOfMonth(event.startsAt)}</div>
            <div className="month">{monthName(event.startsAt)}</div>
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="event-detail-title">{event.name}</h1>
            <p className="text-muted"><Icon name="schedule" size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{formatDate(event.startsAt)}{event.endsAt ? ` — ${formatDate(event.endsAt)}` : ''}</p>
            {event.location && <p className="text-muted"><Icon name="location" size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{event.location}</p>}
            <p className="text-muted text-sm">{event.privacy.toLowerCase()} event · {event._count?.members || 0} going/interested</p>
          </div>
        </div>
        {event.description && (
          <div className="event-detail-desc">
            <h3>About this event</h3>
            <p className="text-muted">{event.description}</p>
          </div>
        )}
        <div className="event-detail-action">
          {isOrganizer ? (
            <button className="btn btn-secondary" onClick={() => navigate('/events')}>Manage event</button>
          ) : (
            <div className="btn-row">
              <button className={`btn ${memberStatus === 'GOING' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => rsvp('GOING')}>
                {memberStatus === 'GOING' ? 'Going' : 'Going'}
              </button>
              <button className={`btn ${memberStatus === 'INTERESTED' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => rsvp('INTERESTED')}>Interested</button>
              <button className={`btn ${memberStatus === 'MAYBE' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => rsvp('MAYBE')}>Maybe</button>
            </div>
          )}
        </div>
        <div className="event-organizer">
          <span className="text-sm text-muted">Hosted by</span>
          <Link to={`/profile/${event.organizer.username}`} className="user-row-link">
            <UserAvatar user={event.organizer} size="sm" />
            <span>{event.organizer.fullName}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}