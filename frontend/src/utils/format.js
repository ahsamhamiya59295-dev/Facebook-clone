export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  const intervals = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [name, value] of intervals) {
    const count = Math.floor(seconds / value);
    if (count >= 1) return count === 1 ? `1 ${name} ago` : `${count} ${name}s ago`;
  }
  return 'just now';
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatFullDate(date) {
  return new Date(date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function monthName(date) {
  return new Date(date).toLocaleDateString([], { month: 'short' });
}

export function dayOfMonth(date) {
  return new Date(date).getDate();
}

export function formatPrice(price, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price);
  } catch (err) {
    return `${currency} ${price}`;
  }
}

export function getInitials(name) {
  return name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function pluralize(count, word) {
  return count === 1 ? `1 ${word}` : `${count} ${word}s`;
}

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function fileToUrl(file) {
  return URL.createObjectURL(file);
}

export function getMediaType(mime) {
  if (mime?.startsWith('image/')) return 'IMAGE';
  if (mime?.startsWith('video/')) return 'VIDEO';
  return 'FILE';
}