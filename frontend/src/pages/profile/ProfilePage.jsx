import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { userService, savedService } from '../../services';
import ProfileHeader from '../../components/profile/ProfileHeader.jsx';
import PostCard from '../../components/post/PostCard.jsx';
import CreatePost from '../../components/post/CreatePost.jsx';
import FriendButton from '../../components/friends/FriendButton.jsx';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Skeleton from '../../components/common/Skeleton.jsx';

export default function ProfilePage() {
  const { username } = useParams();
  const { user, loadAuth } = useAuth();
  const [profile, setProfile] = useState(null);
  const [relation, setRelation] = useState('NONE');
  const [following] = useState(false);
  const [posts, setPosts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [media, setMedia] = useState([]);
  const [tab, setTab] = useState('posts');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const data = await userService.getByUsername(username);
      const u = data.user || {};
      setProfile({
        ...u,
        ...(u.profile || {}),
        _count: u._count || { posts: 0, friends: 0, followers: 0, following: 0 },
      });
      setRelation(data.relation || 'NONE');
    } catch (err) {
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, [username]);

  const loadPosts = useCallback(async () => {
    if (!profile) return;
    setLoadingPosts(true);
    try {
      const data = await userService.posts(profile.id);
      setPosts(data.posts || []);
    } catch (err) {
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [profile]);

  const loadFriends = useCallback(async () => {
    if (!profile) return;
    try {
      const data = await userService.friends(profile.id);
      setFriends(data.friends || []);
    } catch (err) {
      setFriends([]);
    }
  }, [profile]);

  const loadMedia = useCallback(async () => {
    if (!profile) return;
    try {
      const data = await savedService.media(profile.id, 'all');
      setMedia(data.media || []);
    } catch (err) {
      setMedia([]);
    }
  }, [profile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!profile) return;
    if (tab === 'posts') loadPosts();
    if (tab === 'friends') loadFriends();
    if (tab === 'photos') loadMedia();
  }, [profile, tab, loadPosts, loadFriends, loadMedia]);

  const isOwner = user?.id === profile?.id;

  if (loadingProfile) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Skeleton lines={4} />
        <Skeleton lines={3} />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/" replace />;
  }

  const handleTab = (t) => setTab(t);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <ProfileHeader
        profile={{
          ...profile,
          _count: profile._count || { posts: 0, friends: friends.length, followers: 0, following: 0 },
        }}
        isOwner={isOwner}
        relation={relation}
        following={following}
        onProfileChanged={() => { loadProfile(); loadAuth(); }}
      />

      <div className="profile-tabs">
        <button className={`profile-tab ${tab === 'posts' ? 'active' : ''}`} onClick={() => handleTab('posts')}>Posts</button>
        <button className={`profile-tab ${tab === 'about' ? 'active' : ''}`} onClick={() => handleTab('about')}>About</button>
        <button className={`profile-tab ${tab === 'friends' ? 'active' : ''}`} onClick={() => handleTab('friends')}>Friends</button>
        <button className={`profile-tab ${tab === 'photos' ? 'active' : ''}`} onClick={() => handleTab('photos')}>Photos</button>
      </div>

      <div className="profile-grid">
        <div className="profile-left">
          {tab === 'about' ? (
            <div className="card">
              <div className="card-header"><span className="title">About</span></div>
              <div className="card-body" style={{ color: 'var(--text-secondary)' }}>
                <p><Icon name="location" size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />{profile.location || 'No location set'}</p>
                <p style={{ marginTop: 8 }}><Icon name="users_single" size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />{profile.work || 'No work info'}</p>
                <p style={{ marginTop: 8 }}><Icon name="bookmark" size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />{profile.education || 'No education info'}</p>
                {profile.relationshipStatus && <p style={{ marginTop: 8 }}>In a relationship</p>}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <span className="title">Friends</span>
                <Link to={`/friends`} className="text-link text-sm" style={{ marginLeft: 'auto' }}>See all</Link>
              </div>
              <div className="card-body">
                {friends.length === 0 ? (
                  <p className="text-sm text-muted">No friends yet.</p>
                ) : (
                  <div className="friends-grid">
                    {friends.slice(0, 9).map((f) => (
                      <div key={f.id} className="friend-card">
                        <div className="friend-cover" style={{ height: 48, background: 'var(--bg)' }} />
                        <div className="friend-avatar-row">
                          <UserAvatar user={f} size="lg" className="avatar-with-ring" />
                        </div>
                        <Link to={`/profile/${f.username}`} className="friend-name">{f.fullName}</Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {profile.bio && (
            <div className="card">
              <div className="card-header"><span className="title">Intro</span></div>
              <div className="card-body">{profile.bio}</div>
            </div>
          )}
        </div>

        <div className="profile-center">
          {isOwner && <CreatePost onPosted={loadPosts} />}

          {tab === 'posts' && (
            loadingPosts ? <Skeleton lines={3} /> :
            posts.length === 0 ? <EmptyState icon="home" title="No posts yet" subtitle={isOwner ? 'Share something with the world' : 'This user has not posted anything.'} /> :
            posts.map((p) => <PostCard key={p.id} post={p} onPostDelete={() => loadPosts()} />)
          )}

          {tab === 'friends' && (
            friends.length === 0 ? <EmptyState icon="friends" title="No friends" subtitle="Invite people to connect." /> :
            <div className="friends-grid">
              {friends.map((f) => (
                <div key={f.id} className="friend-card">
                  <div className="friend-cover" style={{ height: 48, background: 'var(--bg)' }} />
                  <div className="friend-avatar-row"><UserAvatar user={f} size="lg" className="avatar-with-ring" /></div>
                  <Link to={`/profile/${f.username}`} className="friend-name">{f.fullName}</Link>
                  <div className="friend-actions">
                    {f.id === user.id ? null : (
                      <FriendButton targetUser={f} relation="FRIENDS" compact />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'photos' && (
            media.length === 0 ? <EmptyState icon="image" title="No photos yet" subtitle="Photos posted by this user will appear here." /> :
            <div className="friends-grid">
              {media.map((m, i) => (
                <div key={i} className="friend-card">
                  <img src={m.url} alt="Post" style={{ height: 160, objectFit: 'cover', width: '100%' }} loading="lazy" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}