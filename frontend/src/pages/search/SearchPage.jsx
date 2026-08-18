import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { searchService } from '../../services';
import { useToastActions } from '../../context/ToastContext.jsx';
import Icon from '../../components/common/Icon.jsx';
import UserAvatar from '../../components/common/UserAvatar.jsx';
import PostCard from '../../components/post/PostCard.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { debounce } from '../../utils/format.js';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { error } = useToastActions();
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState({ users: [], posts: [], groups: [], events: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debouncedSearch = useRef();
  if (!debouncedSearch.current) {
    debouncedSearch.current = debounce(async (query) => {
      if (!query.trim()) {
        setResults({ users: [], posts: [], groups: [], events: [] });
        setSearched(false);
        return;
      }
      setLoading(true);
      try {
        const data = await searchService.search(query);
        setResults(data);
        setSearched(true);
      } catch (err) {
        error(err.message);
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  const doSearch = useCallback((query) => debouncedSearch.current(query), []);

  useEffect(() => {
    doSearch(q);
  }, [q, doSearch]);

  return (
    <div className="search-layout">
      <div className="search-input-big">
        <Icon name="search" />
        <input
          placeholder="Search people, posts, groups..."
          value={q}
          onChange={(e) => { setQ(e.target.value); if (!e.target.value) setSearched(false); }}
          autoFocus
          aria-label="Search"
        />
      </div>

      {loading && <div className="loader-wrap"><div className="spinner" /></div>}
      {searched && !loading && (
        <>
          <section className="search-section">
            <h2>People</h2>
            {results.users.length === 0 ? (
              <EmptyState icon="users" title="No people found" />
            ) : (
              results.users.map((u) => (
                <div key={u.id} className="card">
                  <div className="user-row" onClick={() => navigate(`/profile/${u.username}`)}>
                    <UserAvatar user={u} size="lg" />
                    <div className="flex-grow">
                      <div className="user-name">{u.fullName}</div>
                      <div className="user-sub">@{u.username}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="search-section">
            <h2>Posts</h2>
            {results.posts.length === 0 ? (
              <EmptyState icon="home" title="No posts found" />
            ) : (
              results.posts.map((p) => <PostCard key={p.id} post={p} />)
            )}
          </section>

          <section className="search-section">
            <h2>Groups</h2>
            {results.groups.length === 0 ? (
              <EmptyState icon="group" title="No groups found" />
            ) : (
              results.groups.map((g) => (
                <div key={g.id} className="card">
                  <div className="user-row" onClick={() => navigate(`/groups/${g.id}`)}>
                    <Icon name="group" size={40} />
                    <div className="flex-grow">
                      <div className="user-name">{g.name}</div>
                      <div className="user-sub">{g._count?.members || 0} members</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}
      {!searched && !loading && <EmptyState icon="search" title="Search" subtitle="Find people, posts and groups on Facebook." />}
    </div>
  );
}