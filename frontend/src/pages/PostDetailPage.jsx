import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { postService } from '../services';
import PostCard from '../components/post/PostCard.jsx';
import Loader from '../components/common/Loader.jsx';
import EmptyState from '../components/common/EmptyState.jsx';

export default function PostDetailPage() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    postService
      .get(id)
      .then((data) => setPost(data.post))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loader />;
  if (error) return <EmptyState icon="error" title="Post not found" subtitle={error} />;
  if (!post) return <EmptyState icon="home" title="Post not found" />;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <PostCard post={post} />
    </div>
  );
}