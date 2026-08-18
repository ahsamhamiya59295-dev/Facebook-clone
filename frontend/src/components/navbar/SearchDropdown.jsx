import { memo, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../common/Icon.jsx';
import { searchService } from '../../services';

// Search dropdown backed by the user's real search history and real
// trending queries (aggregated from searches across the app).
function SearchDropdown() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [historyRes, trendingRes] = await Promise.all([
        searchService.history(),
        searchService.trending(),
      ]);
      setRecent(historyRes.history || []);
      setTrending(trendingRes.trending || []);
    } catch {
      setRecent([]);
      setTrending([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const saveAndGo = (q) => {
    const term = q.trim();
    if (!term) return;
    searchService.addToHistory(term).catch(() => {});
    setOpen(false);
    setQuery('');
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  const removeItem = (id, e) => {
    e.stopPropagation();
    setRecent((prev) => prev.filter((item) => item.id !== id));
    searchService.removeFromHistory(id).catch(() => {});
  };

  const clearAll = () => {
    setRecent([]);
    searchService.clearHistory().catch(() => {});
  };

  const filtered = query.trim()
    ? recent.filter((item) => item.query.toLowerCase().includes(query.toLowerCase()))
    : recent;

  return (
    <div className={`topbar-search-wrap${open ? ' open' : ''}`} ref={wrapRef}>
      <div
        className="topbar-search"
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        role="search"
        aria-label="Search"
      >
        <Icon name="search" size={16} />
        <input
          ref={inputRef}
          className="topbar-search-input"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveAndGo(query);
          }}
        />
      </div>

      {open && (
        <div className="dropdown-menu search-dropdown anim-pop-in" role="listbox">
          {loading ? (
            <div className="search-empty">Loading…</div>
          ) : (
            <>
              <div className="search-recent-head">
                <span className="search-recent-title">Recent searches</span>
                {recent.length > 0 && (
                  <button
                    type="button"
                    className="search-clear-all"
                    onClick={clearAll}
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="search-recent-list">
                {filtered.length === 0 ? (
                  <div className="search-empty">
                    {query.trim()
                      ? `No recent searches matching "${query}"`
                      : 'No recent searches'}
                  </div>
                ) : (
                  filtered.map((item) => (
                    <div
                      key={item.id}
                      role="option"
                      aria-selected="false"
                      tabIndex={0}
                      className="search-row"
                      onClick={() => saveAndGo(item.query)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveAndGo(item.query); }}
                    >
                      <span className="search-row-icon">
                        <Icon name="clock" size={16} />
                      </span>
                      <span className="search-row-text">
                        <span className="search-row-name ellipsis">{item.query}</span>
                      </span>
                      <button
                        type="button"
                        className="search-row-remove"
                        title="Remove"
                        aria-label="Remove"
                        onClick={(e) => removeItem(item.id, e)}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  ))
                )}

                {trending.length > 0 && (
                  <div className="search-trending">
                    <div className="search-trending-title">
                      <Icon name="trendingUp" size={14} />
                      Trending Topics
                    </div>
                    {trending.map((topic) => (
                      <div
                        key={topic}
                        role="option"
                        tabIndex={0}
                        className="search-trending-item"
                        onClick={() => saveAndGo(topic)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveAndGo(topic); }}
                      >
                        #{topic}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(SearchDropdown);