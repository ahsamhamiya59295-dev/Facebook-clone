import api from './api';

export const authService = {
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }).then((r) => r.data),
  changePassword: (currentPassword, newPassword) => api.post('/auth/me/change-password', { currentPassword, newPassword }).then((r) => r.data),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }).then((r) => r.data),
};

export const userService = {
  getUser: (id) => api.get(`/users/${id}`).then((r) => r.data),
  getByUsername: (username) => api.get(`/users/by-username/${username}`).then((r) => r.data),
  updateMe: (data) => api.patch('/users/me', data).then((r) => r.data),
  avatar: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.patch('/users/me/avatar', fd).then((r) => r.data);
  },
  cover: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.patch('/users/me/cover', fd).then((r) => r.data);
  },
  posts: (id, page = 1) => api.get(`/users/${id}/posts`, { params: { page } }).then((r) => r.data),
  friends: (id) => api.get(`/users/${id}/friends`).then((r) => r.data),
  followers: (id) => api.get(`/users/${id}/followers`).then((r) => r.data),
  following: (id) => api.get(`/users/${id}/following`).then((r) => r.data),
  requests: () => api.get('/users/me/requests').then((r) => r.data),
  suggestions: (limit = 6) => api.get('/users/suggestions', { params: { limit } }).then((r) => r.data),
  mutual: (id) => api.get(`/users/me/mutual/${id}`).then((r) => r.data),
  follow: (id) => api.post(`/users/${id}/follow`).then((r) => r.data),
  unfollow: (id) => api.delete(`/users/${id}/follow`).then((r) => r.data),
};

export const postService = {
  feed: (page = 1) => api.get('/posts/feed', { params: { page } }).then((r) => r.data),
  create: (data) => api.post('/posts', data).then((r) => r.data),
  get: (id) => api.get(`/posts/${id}`).then((r) => r.data),
  update: (id, data) => api.patch(`/posts/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/posts/${id}`).then((r) => r.data),
  share: (id, content) => api.post(`/posts/${id}/share`, { content }).then((r) => r.data),
  comments: (id, page = 1) => api.get(`/posts/${id}/comments`, { params: { page } }).then((r) => r.data),
  addComment: (id, content, parentId) => api.post(`/posts/${id}/comments`, { content, parentId }).then((r) => r.data),
  replies: (commentId) => api.get(`/comments/${commentId}/replies`).then((r) => r.data),
  updateComment: (id, content) => api.patch(`/comments/${id}`, { content }).then((r) => r.data),
  deleteComment: (id) => api.delete(`/comments/${id}`).then((r) => r.data),
  reactComment: (id, type) => api.post(`/comments/${id}/reactions`, { type }).then((r) => r.data),
  react: (id, type) => api.post(`/posts/${id}/reactions`, { type }).then((r) => r.data),
  unreact: (id) => api.delete(`/posts/${id}/reactions`).then((r) => r.data),
  save: (id, collectionId) => api.post(`/saved/${id}`, { collectionId }).then((r) => r.data),
};

export const friendService = {
  send: (id) => api.post(`/friends/request/${id}`).then((r) => r.data),
  accept: (id) => api.post(`/friends/accept/${id}`).then((r) => r.data),
  reject: (id) => api.post(`/friends/reject/${id}`).then((r) => r.data),
  cancel: (id) => api.post(`/friends/cancel/${id}`).then((r) => r.data),
  remove: (id) => api.delete(`/friends/${id}`).then((r) => r.data),
};

export const messageService = {
  conversations: () => api.get('/conversations').then((r) => r.data),
  create: (userId) => api.post('/conversations', { userId }).then((r) => r.data),
  messages: (id, page = 1) => api.get(`/conversations/${id}/messages`, { params: { page } }).then((r) => r.data),
  send: (id, content, file) => {
    if (file) {
      const fd = new FormData();
      fd.append('content', content || '');
      fd.append('file', file);
      return api.post(`/conversations/${id}/messages`, fd).then((r) => r.data);
    }
    return api.post(`/conversations/${id}/messages`, { content }).then((r) => r.data);
  },
  read: (id) => api.patch(`/conversations/${id}/read`).then((r) => r.data),
};

export const notificationService = {
  all: (page = 1) => api.get('/notifications', { params: { page } }).then((r) => r.data),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data),
  settings: () => api.get('/notifications/settings').then((r) => r.data),
  updateSettings: (data) => api.patch('/notifications/settings', data).then((r) => r.data),
};

export const storyService = {
  all: () => api.get('/stories').then((r) => r.data),
  create: (file, caption) => {
    const fd = new FormData();
    fd.append('file', file);
    if (caption) fd.append('caption', caption);
    return api.post('/stories', fd).then((r) => r.data);
  },
  view: (id) => api.post(`/stories/${id}/view`).then((r) => r.data),
  remove: (id) => api.delete(`/stories/${id}`).then((r) => r.data),
  viewers: (id) => api.get(`/stories/${id}/viewers`).then((r) => r.data),
};

export const groupService = {
  all: () => api.get('/groups').then((r) => r.data),
  get: (id) => api.get(`/groups/${id}`).then((r) => r.data),
  create: (data) => api.post('/groups', data).then((r) => r.data),
  join: (id) => api.post(`/groups/${id}/join`).then((r) => r.data),
  leave: (id) => api.post(`/groups/${id}/leave`).then((r) => r.data),
  posts: (id) => api.get(`/groups/${id}/posts`).then((r) => r.data),
  createPost: (id, data, file) => {
    if (file) {
      const fd = new FormData();
      fd.append('content', data.content || '');
      fd.append('file', file);
      return api.post(`/groups/${id}/posts`, fd).then((r) => r.data);
    }
    return api.post(`/groups/${id}/posts`, data).then((r) => r.data);
  },
};

export const eventService = {
  all: () => api.get('/events').then((r) => r.data),
  get: (id) => api.get(`/events/${id}`).then((r) => r.data),
  create: (data, file) => {
    if (file) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => v !== undefined && v !== null && fd.append(k, v));
      fd.append('file', file);
      return api.post('/events', fd).then((r) => r.data);
    }
    return api.post('/events', data).then((r) => r.data);
  },
  rsvp: (id, status) => api.post(`/events/${id}/rsvp`, { status }).then((r) => r.data),
};

export const marketplaceService = {
  all: (params) => api.get('/marketplace', { params }).then((r) => r.data),
  get: (id) => api.get(`/marketplace/${id}`).then((r) => r.data),
  create: (data, files) => {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => v !== undefined && v !== null && fd.append(k, v));
    files.forEach((f) => fd.append('files', f));
    return api.post('/marketplace', fd).then((r) => r.data);
  },
  update: (id, data) => api.patch(`/marketplace/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/marketplace/${id}`).then((r) => r.data),
};

export const savedService = {
  all: () => api.get('/saved').then((r) => r.data),
  toggle: (id) => api.post(`/saved/${id}`).then((r) => r.data),
  createCollection: (name) => api.post('/saved/collections', { name }).then((r) => r.data),
  removeCollection: (id) => api.delete(`/saved/collections/${id}`).then((r) => r.data),
  media: (id, type) => api.get(`/saved/users/${id}/media`, { params: { type } }).then((r) => r.data),
};

export const searchService = {
  search: (q) => api.get('/search', { params: { q } }).then((r) => r.data),
  history: () => api.get('/search/history').then((r) => r.data),
  addToHistory: (query) => api.post('/search/history', { query }).then((r) => r.data),
  removeFromHistory: (id) => api.delete(`/search/history/${id}`).then((r) => r.data),
  clearHistory: () => api.delete('/search/history').then((r) => r.data),
  trending: () => api.get('/search/trending').then((r) => r.data),
};

export const videoService = {
  all: () => api.get('/videos').then((r) => r.data),
};

export const streamService = {
  all: () => api.get('/streams').then((r) => r.data),
};

export const safetyService = {
  blocked: () => api.get('/safety/blocked').then((r) => r.data),
  block: (id) => api.post(`/safety/blocks/${id}`).then((r) => r.data),
  unblock: (id) => api.delete(`/safety/blocks/${id}`).then((r) => r.data),
  report: (data) => api.post('/safety/reports', data).then((r) => r.data),
};

export const adminService = {
  dashboard: () => api.get('/admin/dashboard').then((r) => r.data),
  users: (params) => api.get('/admin/users', { params }).then((r) => r.data),
  toggleStatus: (id) => api.patch(`/admin/users/${id}/status`).then((r) => r.data),
  setRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }).then((r) => r.data),
  removeUser: (id) => api.delete(`/admin/users/${id}`).then((r) => r.data),
  reports: (params) => api.get('/admin/reports', { params }).then((r) => r.data),
  resolveReport: (id) => api.patch(`/admin/reports/${id}/resolve`).then((r) => r.data),
};