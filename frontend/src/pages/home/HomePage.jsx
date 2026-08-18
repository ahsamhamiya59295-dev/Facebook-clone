import { useState, useEffect, useCallback, useRef } from 'react';
import { postService, storyService } from '../../services';
import CreatePost from '../../components/post/CreatePost.jsx';
import PostCard from '../../components/post/PostCard.jsx';
import StoryBar from '../../components/stories/StoryBar.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Icon from '../../components/common/Icon.jsx';
import Skeleton from '../../components/common/Skeleton.jsx';

export default function HomePage() {
  
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const loadMoreRef = useRef(null);

  const loadPosts = useCallback(async (p = 1, append = false) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const data = await postService.feed(p);
      setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
      setHasMore(data.hasMore);
      setPage(p);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load your feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadStories = useCallback(async () => {
    try {
      const data = await storyService.all();
      setStories(data.groups || []);
    } catch (err) {
      setStories([]);
    }
  }, []);

  useEffect(() => {
    loadPosts(1);
    loadStories();
  }, [loadPosts, loadStories]);

  useEffect(() => {
    if (!hasMore) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMore && !loading) {
        loadPosts(page + 1, true);
      }
    }, { rootMargin: '200px' });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMoreRef, page, loadingMore, loading, loadPosts]);

  const handlePosted = useCallback((post) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  const handleDelete = useCallback((post) => {
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <StoryBar stories={stories} onRefresh={loadStories} />
      <CreatePost onPosted={handlePosted} />

      {loading && page === 1 ? (
        <>
          <Skeleton lines={4} />
          <Skeleton lines={3} />
        </>
      ) : error && posts.length === 0 ? (
        <div className="empty-state">
          <Icon name="error" />
          <h3>Couldn&apos;t load your feed</h3>
          <p className="text-muted">{error}</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => loadPosts(1)}>
            Try again
          </button>
        </div>
      ) : posts.length === 0 ? (
        <EmptyState icon="home" title="Your feed is quiet" subtitle="Create a post or add friends to see updates." />
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onPostDelete={handleDelete} />
          ))}
          <div ref={loadMoreRef} style={{ height: 20 }} />
          {loadingMore && <div className="loader-wrap" style={{ padding: 16 }}><div className="spinner spinner-sm" /></div>}
        </>
      )}
    </div>
  );
}