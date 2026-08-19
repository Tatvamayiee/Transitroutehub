import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './pages/LandingPage';
import { RoleSelectionPage } from './pages/RoleSelectionPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { FindSpacePage } from './pages/FindSpacePage';
import { PostCargoPage } from './pages/PostCargoPage';
import { ShipmentsPage } from './pages/ShipmentsPage';
import { ShipmentDetailPage } from './pages/ShipmentDetailPage';
import { RoutesPage } from './pages/RoutesPage';
import { RouteDetailPage } from './pages/RouteDetailPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { MatchingCenterPage } from './pages/MatchingCenterPage';
import { OptimizationPage } from './pages/OptimizationPage';
import { DeliveryDeskPage } from './pages/DeliveryDeskPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/role-selection" element={<RoleSelectionPage />} />
          <Route path="/login" element={<RoleSelectionPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login/form" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/find-space" element={<ProtectedRoute capability="FIND_SPACE"><FindSpacePage /></ProtectedRoute>} />
            <Route path="/post-cargo" element={<ProtectedRoute capability="POST_CARGO"><PostCargoPage /></ProtectedRoute>} />
            <Route path="/shipments" element={<ProtectedRoute capability="TRACK"><ShipmentsPage /></ProtectedRoute>} />
            <Route path="/shipments/:id" element={<ProtectedRoute capability="TRACK"><ShipmentDetailPage /></ProtectedRoute>} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/routes/:id" element={<RouteDetailPage />} />
            <Route path="/analytics" element={<ProtectedRoute capability="VIEW_ANALYTICS"><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/matching-center" element={<ProtectedRoute capability="MATCH"><MatchingCenterPage /></ProtectedRoute>} />
            <Route path="/optimization" element={<ProtectedRoute capability="OPTIMIZE"><OptimizationPage /></ProtectedRoute>} />
            <Route path="/delivery-desk" element={<ProtectedRoute capability="UPDATE_SHIPMENT"><DeliveryDeskPage /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;