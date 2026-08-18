import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { eventService } from '../../services';
import { useToastActions } from '../../context/ToastContext.jsx';
import Icon from '../../components/common/Icon.jsx';
import Modal from '../../components/common/Modal.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { EVENT_PRIVACY } from '../../constants';
import { monthName, dayOfMonth, formatDate } from '../../utils/format.js';

export default function EventsPage() {
  const { success, error } = useToastActions();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', location: '', startsAt: '', endsAt: '', privacy: 'PUBLIC' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await eventService.all();
      setEvents(data.events || []);
    } catch (err) {
      error(err.message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name.trim() || !form.startsAt) {
      error('Name and start date are required');
      return;
    }
    try {
      await eventService.create(form);
      success('Event created');
      setCreateOpen(false);
      setForm({ name: '', description: '', location: '', startsAt: '', endsAt: '', privacy: 'PUBLIC' });
      load();
    } catch (err) {
      error(err.message);
    }
  };

  const rsvp = async (id, status) => {
    try {
      await eventService.rsvp(id, status);
      success(status === 'GOING' ? 'You are going!' : 'Status updated');
      load();
    } catch (err) {
      error(err.message);
    }
  };

  return (
    <div className="app-view">
      <aside className="app-rail" aria-label="Events navigation">
        <div className="rail-header">
          <h2>Events</h2>
          <button className="circle-btn" aria-label="Search events" style={{ flexShrink: 0 }}>
            <Icon name="search" />
          </button>
        </div>
        <div className="rail-item blue">
          <span className="rail-icon"><Icon name="calendar" /></span>
          <span>Your events</span>
        </div>
        <div className="rail-item">
          <span className="rail-icon"><Icon name="birthday" /></span>
          <span>Birthdays</span>
        </div>
        <div className="rail-item">
          <span className="rail-icon"><Icon name="friends" /></span>
          <span>Friend events</span>
        </div>
        <div className="rail-item">
          <span className="rail-icon"><Icon name="compass" /></span>
          <span>Discover</span>
        </div>
        <div className="rail-divider" />
        <button className="rail-create" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" /> Create event
        </button>
      </aside>

      <div className="app-content wide">
        <div className="section-card" style={{ marginBottom: 0 }}>
          <div className="section-head">
            <h2 className="section-title">Upcoming events</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}>
              <Icon name="plus" size={14} /> Create Event
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          {loading ? (
            <div className="loader-wrap"><div className="spinner" /></div>
          ) : events.length === 0 ? (
            <EmptyState icon="calendar" title="No events yet" subtitle="Create an event or check back soon." />
          ) : (
            events.map((e) => (
              <div key={e.id} className="event-card">
                <Link to={`/events/${e.id}`} style={{ display: 'flex', flex: 1, gap: 12, color: 'inherit', textDecoration: 'none' }}>
                  <div className="event-date-box">
                    <div className="day">{dayOfMonth(e.startsAt)}</div>
                    <div className="month">{monthName(e.startsAt)}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3>{e.name}</h3>
                    <p>{formatDate(e.startsAt)}</p>
                    {e.location && <p><Icon name="location" size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{e.location}</p>}
                    {e.description && <p>{e.description}</p>}
                  </div>
                </Link>
                <div className="event-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => rsvp(e.id, 'GOING')}>Going</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => rsvp(e.id, 'INTERESTED')}>Interested</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {createOpen && (
        <Modal
          title="Create Event"
          onClose={() => setCreateOpen(false)}
          footer={<button className="btn btn-primary btn-block" onClick={create}>Create Event</button>}
        >
          <div className="form-group">
            <label className="form-label">Event name</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Start date</label>
            <input className="form-input" type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">End date (optional)</label>
            <input className="form-input" type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Privacy</label>
            <select className="form-select" value={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.value })}>
              {EVENT_PRIVACY.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}