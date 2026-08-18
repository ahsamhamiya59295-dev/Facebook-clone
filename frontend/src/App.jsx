import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute, GuestRoute } from './routes/ProtectedRoute.jsx';
import Layout from './components/layout/Layout.jsx';

const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage.jsx'));
const HomePage = lazy(() => import('./pages/home/HomePage.jsx'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage.jsx'));
const FriendsPage = lazy(() => import('./pages/friends/FriendsPage.jsx'));
const FriendRequestsPage = lazy(() => import('./pages/friends/FriendRequestsPage.jsx'));
const MessagesPage = lazy(() => import('./pages/messages/MessagesPage.jsx'));
const ConversationPage = lazy(() => import('./pages/messages/ConversationPage.jsx'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage.jsx'));
const SearchPage = lazy(() => import('./pages/search/SearchPage.jsx'));
const GroupsPage = lazy(() => import('./pages/groups/GroupsPage.jsx'));
const GroupDetailPage = lazy(() => import('./pages/groups/GroupDetailPage.jsx'));
const MarketplacePage = lazy(() => import('./pages/marketplace/MarketplacePage.jsx'));
const MarketplaceDetailPage = lazy(() => import('./pages/marketplace/MarketplaceDetailPage.jsx'));
const ReelsPage = lazy(() => import('./pages/reels/ReelsPage.jsx'));
const GamingPage = lazy(() => import('./pages/gaming/GamingPage.jsx'));
const EventsPage = lazy(() => import('./pages/events/EventsPage.jsx'));
const EventDetailPage = lazy(() => import('./pages/events/EventDetailPage.jsx'));
const SavedPage = lazy(() => import('./pages/saved/SavedPage.jsx'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage.jsx'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));
const PostDetailPage = lazy(() => import('./pages/PostDetailPage.jsx'));

function PageLoader() {
  return (
    <div className="loader-wrap" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner spinner-lg" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/posts/:id" element={<PostDetailPage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/friends/requests" element={<FriendRequestsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<ConversationPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/marketplace/:id" element={<MarketplaceDetailPage />} />
            <Route path="/reels" element={<ReelsPage />} />
            <Route path="/gaming" element={<GamingPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}