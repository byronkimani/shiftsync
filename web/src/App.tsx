import { ClerkProvider, useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useEffect } from 'react';
import { apiClient } from './lib/api';

import { AuthGuard } from './components/auth/AuthGuard';
import { RoleGuard } from './components/auth/RoleGuard';
import { AppShell } from './components/layout/AppShell';

// Pages
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import SchedulePage from './pages/SchedulePage';
import LocationSchedulePage from './pages/LocationSchedulePage';
import MyShiftsPage from './pages/MyShiftsPage';
import AvailabilityEditorPage from './pages/AvailabilityEditorPage';
import SwapRequestsPage from './pages/SwapRequestsPage';
import StaffListPage from './pages/StaffListPage';
import StaffProfilePage from './pages/StaffProfilePage';
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage';
import OvertimeDetailPage from './pages/OvertimeDetailPage';
import FairnessReportPage from './pages/FairnessReportPage';
import AuditLogPage from './pages/AuditLogPage';
import NotificationCenterPage from './pages/NotificationCenterPage';
import UserSettingsPage from './pages/UserSettingsPage';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ApiInterceptorProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  useEffect(() => {
    const requestInterceptor = apiClient.interceptors.request.use(async (config) => {
      try {
        const token = await getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        console.warn("Error getting Clerk token", e);
      }
      return config;
    });

    const responseInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          signOut();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      apiClient.interceptors.request.eject(requestInterceptor);
      apiClient.interceptors.response.eject(responseInterceptor);
    };
  }, [getToken, signOut]);

  return <>{children}</>;
}

function RootRedirect() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <div>Loading...</div>;

  const role = (user?.publicMetadata?.role as string) || 'staff';
  return <Navigate to={role === 'staff' ? '/my-shifts' : '/schedule'} replace />;
}

function ClerkWithNavigation({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ClerkWithNavigation>
          <Routes>
            {/* Public */}
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />

            {/* Protected App Shell */}
            <Route element={<AuthGuard><ApiInterceptorProvider><AppShell /></ApiInterceptorProvider></AuthGuard>}>

              {/* Intelligent Root Routing */}
              <Route path="/" element={<RootRedirect />} />

              {/* Manager & Admin Only */}
              <Route element={<RoleGuard allowedRoles={['admin', 'manager']} fallbackPath="/my-shifts"><Outlet /></RoleGuard>}>
                <Route path="/schedule" element={<SchedulePage />} />
                <Route path="/schedule/:locationId" element={<LocationSchedulePage />} />
                <Route path="/staff" element={<StaffListPage />} />
                <Route path="/staff/:id" element={<StaffProfilePage />} />
                <Route path="/analytics" element={<AnalyticsDashboardPage />} />
                <Route path="/analytics/overtime" element={<OvertimeDetailPage />} />
                <Route path="/analytics/fairness" element={<FairnessReportPage />} />
              </Route>

              {/* Admin Only */}
              <Route element={<RoleGuard allowedRoles={['admin']} fallbackPath="/schedule"><Outlet /></RoleGuard>}>
                <Route path="/audit" element={<AuditLogPage />} />
              </Route>

              {/* Staff Only */}
              <Route element={<RoleGuard allowedRoles={['staff']} fallbackPath="/schedule"><Outlet /></RoleGuard>}>
                <Route path="/my-shifts" element={<MyShiftsPage />} />
                <Route path="/availability" element={<AvailabilityEditorPage />} />
              </Route>

              {/* Shared by all roles */}
              <Route path="/swaps" element={<SwapRequestsPage />} />
              <Route path="/notifications" element={<NotificationCenterPage />} />
              <Route path="/settings" element={<UserSettingsPage />} />

            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ClerkWithNavigation>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
