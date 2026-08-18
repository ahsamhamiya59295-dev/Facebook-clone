import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groupService } from '../../services';
import { useToastActions } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';

export default function GroupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error } = useToastActions();
  const [group, setGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await groupService.get(id);
      setGroup(data.group);
      const pdata = await groupService.posts(id);
      setPosts(pdata.posts || []);
    } catch (err) {
      error(err.message);
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  }, [id, error, navigate]);

  useEffect(() => { load(); }, [load]);

  const isMember = group?.members?.some((m) => m.userId === user.id) || group?.ownerId === user.id;

  const join = async () => {
    try {
      await groupService.join(id);
      success('Joined group');
      load();
    } catch (err) {
      error(err.message);
    }
  };

  const post = async () => {
    if (!content.trim() && !file) {
      error('Write something first');
      return;
    }
    try {
      await groupService.createPost(id, { content }, file);
      setContent('');
      setFile(null);
      load();
    } catch (err) {
      error(err.message);
    }
  };

  if (loading) return <div className="loader-wrap"><div className="spinner" /></div>;

  return (
    <div className="app-view">
      <aside className="app-rail" aria-label="Group information">
        <div className="rail-header">
          <h2 className="ellipsis">{group.name}</h2>
        </div>
        <div className="rail-item">
          <span className="rail-icon" style={{ borderRadius: 8, border: '1px solid var(--divider)', color: 'var(--fb-blue)' }}>{group.name?.[0]?.toUpperCase()}</span>
          <span className="ellipsis">{group.name}</span>
        </div>
        <div className="rail-item">
          <span className="rail-icon"><Icon name="globe" size={20} /></span>
          <span>{group.privacy} group</span>
        </div>
        <div className="rail-item">
          <span className="rail-icon"><Icon name="users" size={20} /></span>
          <span>{group._count?.members || 0} members</span>
        </div>
        {group.description && (
          <div className="rail-item">
            <span className="rail-icon"><Icon name="info" size={20} /></span>
            <span className="ellipsis">{group.description}</span>
          </div>
        )}
        <div className="rail-divider" />
        <div className="rail-title">About</div>
      </aside>

      <div className="app-content wide">
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>{group.name}</h2>
              <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                {group._count?.members || 0} members · {group.privacy.toLowerCase()} group
              </p>
            </div>
            {!isMember && <button className="btn btn-primary btn-sm" onClick={join}>Join Group</button>}
          </div>
          {group.description && <p className="text-muted" style={{ marginTop: 8 }}>{group.description}</p>}
        </div>

        {isMember && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <UserAvatar user={user} size="lg" />
              <textarea
                className="composer-textarea"
                placeholder="Share something with the group..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={{ flex: 1, marginLeft: 12 }}
              />
            </div>
            <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Icon name="image" size={16} /> {file ? file.name : 'Add photo'}
                <input type="file" accept="image/*,video/*" hidden onChange={(e) => setFile(e.target.files?.[0])} />
              </label>
              <button className="btn btn-primary btn-sm" onClick={post}>Post</button>
            </div>
          </div>
        )}

        {posts.length === 0 ? (
          <EmptyState icon="group" title="No posts in this group yet" />
        ) : (
          posts.map((p) => (
            <div key={p.id} className="post-card">
              <div className="post-head">
                <UserAvatar user={p.author} size="md" />
                <div style={{ marginLeft: 8 }}>
                  <div className="post-author-name">{p.author.fullName}</div>
                </div>
              </div>
              {p.content && <div className="post-content">{p.content}</div>}
              {p.mediaUrl && (p.mediaType === 'VIDEO' ? <video src={p.mediaUrl} controls preload="metadata" /> : <img src={p.mediaUrl} alt="" loading="lazy" decoding="async" />)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}