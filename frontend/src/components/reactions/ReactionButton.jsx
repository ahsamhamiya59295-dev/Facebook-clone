import { memo, useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../common/Icon.jsx';
import { REACTION_CONFIGS, ReactionIcon } from './ReactionIcons.jsx';

// Like button + hover-to-reveal dock. On desktop the dock opens after 450ms of
// hover; on touch devices a 400ms press opens it (mirrors the helper).
//
// Props:
//   - activeReaction: string | null    — current reaction set by the user (LIKE / LOVE / …)
//   - onReact(type)                    — set a reaction (or clear, when type === activeReaction)
//   - onClear()                        — remove the active reaction
const ReactionButton = memo(function ReactionButton({ activeReaction, onReact, onClear }) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const longPressFired = useRef(false);
  const pressStart = useRef({ x: 0, y: 0 });
  const pressTimer = useRef(null);
  const wrapperRef = useRef(null);

  const cancelTimers = useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    cancelTimers();
    openTimer.current = setTimeout(() => setOpen(true), 450);
  }, [cancelTimers]);

  const scheduleClose = useCallback(() => {
    cancelTimers();
    closeTimer.current = setTimeout(() => setOpen(false), 250);
  }, [cancelTimers]);

  useEffect(() => () => {
    cancelTimers();
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, [cancelTimers]);

  // Close on outside click / Escape while open
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSelect = (type) => {
    setOpen(false);
    if (type === activeReaction) onClear?.();
    else onReact?.(type);
  };

  const handleLikeClick = () => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (activeReaction) onClear?.();
    else onReact?.('LIKE');
  };

  // Touch long-press mirrors hover
  const onTouchStart = (e) => {
    longPressFired.current = false;
    const t = e.touches[0];
    pressStart.current = { x: t.clientX, y: t.clientY };
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setOpen(true);
    }, 400);
  };

  const onTouchMove = (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - pressStart.current.x) > 12 || Math.abs(t.clientY - pressStart.current.y) > 12) {
      clearTimeout(pressTimer.current);
    }
  };

  const onTouchEnd = () => clearTimeout(pressTimer.current);

  const activeConfig = REACTION_CONFIGS.find((r) => r.type === activeReaction);

  return (
    <div className="like-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className={`post-action like-btn${activeReaction ? ' active' : ''}${activeReaction ? ` ${activeReaction.toLowerCase()}` : ''}`}
        onClick={handleLikeClick}
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocus={scheduleOpen}
        onBlur={scheduleClose}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-pressed={!!activeReaction}
        aria-haspopup="true"
      >
        {activeConfig ? (
          <>
            {activeConfig.type === 'LIKE' ? (
              <Icon name="like" size={16} />
            ) : (
              <ReactionIcon type={activeConfig.type} size={20} />
            )}
            <span>{activeConfig.label}</span>
          </>
        ) : (
          <>
            <Icon name="thumbOutline" size={16} />
            <span>Like</span>
          </>
        )}
      </button>

      {open && (
        <div
          className="reaction-dock"
          role="toolbar"
          aria-label="Reactions"
          onMouseEnter={cancelTimers}
          onMouseLeave={scheduleClose}
        >
          {REACTION_CONFIGS.map((r) => (
            <button
              key={r.type}
              type="button"
              className={`reaction-dock-item${activeReaction === r.type ? ' active' : ''}`}
              onClick={() => handleSelect(r.type)}
              aria-label={r.label}
            >
              <span className="reaction-dock-tooltip">{r.label}</span>
              <ReactionIcon type={r.type} size={40} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default ReactionButton;
