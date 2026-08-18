// Facebook-style reaction stickers — 36px colored SVG circles with the exact
// artwork from the helper's ReactionIcons.tsx. Mirrors the helper but exposes
// the 6 reactions the backend ReactionType enum actually supports. The active
// set is exported as REACTION_CONFIGS (consumed by ReactionButton + PostCard
// summary row). A seventh CARE entry is included in ALL_REACTIONS for forward
// compatibility but not exported via REACTION_CONFIGS so the UI stays in sync
// with the API.

import { memo } from 'react';

const STICKERS = {
  LIKE: (
    <>
      <circle cx="18" cy="18" r="18" fill="#1877F2" />
      <path
        d="M27.2 17.5c0-.9-.6-1.6-1.5-1.7.5-.4.8-1 .7-1.7-.1-.9-.8-1.5-1.7-1.6.3-.4.4-1 .3-1.5-.2-1-1-1.7-2-1.7h-4.8c.2-.9.7-2.7.7-3.8 0-1.8-1.1-2.5-2.2-2.5-.7 0-1.3.4-1.6 1-.7 1.3-1.6 3.6-3.1 5.3v10.3c1.5 0 3.3.7 4.5 1.5 1.1.7 2.5 1.2 3.9 1.2h4c1.1 0 2-.9 2-2 0-.4-.1-.8-.3-1.1.8-.3 1.4-1.1 1.4-2 0-.4-.1-.7-.3-1 .8-.4 1.4-1.1 1.4-2 0-.3-.1-.6-.2-.9.7-.3 1.2-1 1.2-1.8zM9 13h3v11H9z"
        fill="white"
      />
    </>
  ),
  LOVE: (
    <>
      <circle cx="18" cy="18" r="18" fill="#F33E58" />
      <path
        d="M18 26.5l-1.3-1.2C11.8 20.8 8.5 17.8 8.5 14c0-3.1 2.4-5.5 5.5-5.5 1.7 0 3.4.8 4 2.1.6-1.3 2.3-2.1 4-2.1 3.1 0 5.5 2.4 5.5 5.5 0 3.8-3.3 6.8-8.2 11.3L18 26.5z"
        fill="white"
      />
    </>
  ),
  CARE: (
    <>
      <circle cx="18" cy="18" r="18" fill="#F7B125" />
      <circle cx="13" cy="13.5" r="2" fill="#7D4900" />
      <circle cx="23" cy="13.5" r="2" fill="#7D4900" />
      <path d="M14 18c1.2 1.5 2.7 2 4 2s2.8-.5 4-2" stroke="#7D4900" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M18 27.5l-.9-.8C13.2 23.3 11 21.1 11 18.5c0-2.1 1.6-3.5 3.5-3.5 1.2 0 2.3.6 2.8 1.5.5-.9 1.6-1.5 2.8-1.5 1.9 0 3.5 1.4 3.5 3.5 0 2.6-2.2 4.8-6.1 8.2l-.5.3z"
        fill="#F33E58"
      />
      <path d="M8.5 20c1.5-2 3.5-3 5.5-2M27.5 20c-1.5-2-3.5-3-5.5-2" stroke="#D18300" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  HAHA: (
    <>
      <circle cx="18" cy="18" r="18" fill="#F7B125" />
      <path d="M10 13l4 2.5-4 2.5M26 13l-4 2.5 4 2.5" stroke="#7D4900" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 20c1.2 4.5 4.3 7 7.5 7s6.3-2.5 7.5-7H10.5z" fill="#7D4900" />
      <path d="M14.5 24c1.1 1.5 2.3 2 3.5 2s2.4-.5 3.5-2c-.8-1-2-1.5-3.5-1.5s-2.7.5-3.5 1.5z" fill="#F33E58" />
    </>
  ),
  WOW: (
    <>
      <circle cx="18" cy="18" r="18" fill="#F7B125" />
      <path d="M10.5 9c1.5-1.5 3.5-1.5 5 0M20.5 9c1.5-1.5 3.5-1.5 5 0" stroke="#7D4900" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="13" cy="14" rx="2.2" ry="3" fill="#7D4900" />
      <ellipse cx="23" cy="14" rx="2.2" ry="3" fill="#7D4900" />
      <ellipse cx="18" cy="23" rx="4.5" ry="6" fill="#7D4900" />
    </>
  ),
  SAD: (
    <>
      <circle cx="18" cy="18" r="18" fill="#F7B125" />
      <path d="M10.5 11c1.5 1 3.5 1 5 0M20.5 11c1.5 1 3.5 1 5 0" stroke="#7D4900" strokeWidth="2" strokeLinecap="round" />
      <circle cx="13" cy="15.5" r="2.2" fill="#7D4900" />
      <circle cx="23" cy="15.5" r="2.2" fill="#7D4900" />
      <path d="M13 24c1.5-2 3.2-2.5 5-2.5s3.5.5 5 2.5" stroke="#7D4900" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M25 19c0 1.5-1 2.5-2.2 2.5S20.5 20.5 21.5 19c.6-.9 1.3-2 1.3-2s1.5 1 2.2 2z" fill="#2D88FF" />
    </>
  ),
  ANGRY: (
    <>
      <circle cx="18" cy="18" r="18" fill="#E9710F" />
      <path d="M10 11.5l5 3M26 11.5l-5 3" stroke="#4A1E00" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="13" cy="16.5" r="2" fill="#4A1E00" />
      <circle cx="23" cy="16.5" r="2" fill="#4A1E00" />
      <path d="M12.5 24c1.8-2 3.5-2.5 5.5-2.5s3.7.5 5.5 2.5" stroke="#4A1E00" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
};

export const ALL_REACTIONS = [
  { type: 'LIKE', label: 'Like', color: '#1877F2' },
  { type: 'LOVE', label: 'Love', color: '#F33E58' },
  { type: 'CARE', label: 'Care', color: '#F7B125' },
  { type: 'HAHA', label: 'Haha', color: '#F7B125' },
  { type: 'WOW', label: 'Wow', color: '#F7B125' },
  { type: 'SAD', label: 'Sad', color: '#F7B125' },
  { type: 'ANGRY', label: 'Angry', color: '#E9710F' },
];

// Active UI set — matches the backend ReactionType enum (LIKE / LOVE / CARE /
// HAHA / WOW / SAD / ANGRY) and the helper's 7-reaction dock.
export const REACTION_CONFIGS = ALL_REACTIONS;

function ReactionSticker({ type, size = 36, className = '' }) {
  const cfg = ALL_REACTIONS.find((r) => r.type === type);
  if (!cfg) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      aria-label={cfg.label}
      role="img"
    >
      {STICKERS[type]}
    </svg>
  );
}

const Wrapped = memo(ReactionSticker);
export { Wrapped as ReactionSticker };

export function ReactionIcon({ type, size, className }) {
  return <Wrapped type={type} size={size} className={className} />;
}

export default Wrapped;
