import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth';
import Layout from './components/Layout';
import AdminRoute from './components/AdminRoute';
import OfflineBadge from './components/OfflineBadge';
import AdminLoginPage from './pages/AdminLoginPage';
import HomePage from './pages/HomePage';
import MeetingSchedulePage from './pages/MeetingSchedulePage';
import RegistrationPage from './pages/RegistrationPage';
import RestaurantPage from './pages/RestaurantPage';
import RestroomMapPage from './pages/RestroomMapPage';
import VotingPage from './pages/VotingPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="p-4 text-red-600">Something went wrong. Please refresh the page.</div>;
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <OfflineBadge />
        <Routes>
          <Route path="/admin-login" element={<AdminLoginPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/meeting-schedule" element={<MeetingSchedulePage />} />
            <Route path="/registration" element={<RegistrationPage />} />
            <Route path="/restaurant" element={<RestaurantPage />} />
            <Route path="/restrooms" element={<RestroomMapPage />} />
            <Route path="/voting" element={<VotingPage />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}
