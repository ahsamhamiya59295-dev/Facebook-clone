import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

// Attach the CSRF token for any state-mutating request (double-submit pattern).
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = readCookie('fb_clone_csrf');
    if (token) config.headers['X-CSRF-Token'] = token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      (error.code === 'ERR_NETWORK' ? 'Cannot reach the server. Is it running?' : error.message) ||
      'Something went wrong';
    const payload = new Error(message);
    payload.status = error.response?.status || error.code;
    payload.details = error.response?.data?.details;
    payload.response = error.response;
    return Promise.reject(payload);
  },
);

export default api;