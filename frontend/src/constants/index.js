export const REACTIONS = [
  { type: 'LIKE', emoji: '👍', label: 'Like', color: '#0866ff' },
  { type: 'LOVE', emoji: '❤️', label: 'Love', color: '#f33e58' },
  { type: 'CARE', emoji: '🤗', label: 'Care', color: '#f7b125' },
  { type: 'HAHA', emoji: '😂', label: 'Haha', color: '#f7b928' },
  { type: 'WOW', emoji: '😮', label: 'Wow', color: '#f7b928' },
  { type: 'SAD', emoji: '😢', label: 'Sad', color: '#f7b928' },
  { type: 'ANGRY', emoji: '😡', label: 'Angry', color: '#e40a0a' },
];

export const PRIVACY_LEVELS = [
  { value: 'PUBLIC', label: 'Public', icon: 'globe' },
  { value: 'FRIENDS', label: 'Friends', icon: 'users' },
  { value: 'ONLY_ME', label: 'Only Me', icon: 'lock' },
];

export const PRIVACY_ICON = {
  PUBLIC: 'globe',
  FRIENDS: 'users',
  ONLY_ME: 'lock',
};

export const GROUP_PRIVACY = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'PRIVATE', label: 'Private' },
  { value: 'CLOSED', label: 'Closed' },
];

export const EVENT_PRIVACY = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'FRIENDS', label: 'Friends' },
  { value: 'INVITE_ONLY', label: 'Invite Only' },
];

export const CATEGORIES = ['Vehicles', 'Electronics', 'Furniture', 'Home & Garden', 'Clothing', 'Sports', 'Toys', 'Other'];

export const NAV_TABS = [
  { path: '/', icon: 'home', outline: 'homeOutline', filled: 'homeFilled', label: 'Home' },
  { path: '/friends', icon: 'friends', outline: 'friendsOutline', filled: 'friendsFilled', label: 'Friends' },
  { path: '/reels', icon: 'reels', outline: 'videoOutline', filled: 'videoFilled', label: 'Reels' },
  { path: '/marketplace', icon: 'marketplace', outline: 'marketplaceOutline', filled: 'marketplaceFilled', label: 'Marketplace' },
  { path: '/gaming', icon: 'gaming', outline: 'gamingOutline', filled: 'gamingFilled', label: 'Gaming' },
];
