import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "./AuthContext";
import { AppShell } from "./AppShell";
import { RequireAuth } from "./RequireAuth";
import { LoginPage } from "../features/auth/LoginPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { ProjectListPage } from "../features/projects/ProjectListPage";
import { ProjectDetailPage } from "../features/projects/ProjectDetailPage";
import { IntakePage } from "../features/intake/IntakePage";
import { TeamInboxPage } from "../features/team-inbox/TeamInboxPage";
import { NotificationsPage } from "../features/notifications/NotificationsPage";
import { PlaceholderPage } from "../features/static-pages/PlaceholderPage";
import { MeetingCenterPage } from "../features/meeting-center/MeetingCenterPage";
import { MeetingDetailPage } from "../features/meeting-center/MeetingDetailPage";
import { ProjectWorkspacePage } from "../features/workspace/ProjectWorkspacePage";

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/team-inbox/:id/workspace" element={<ProjectWorkspacePage />} />
        <Route path="/intake" element={<IntakePage />} />
        <Route path="/team-inbox" element={<TeamInboxPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route
          path="/analytics"
          element={<PlaceholderPage title="Analytics" description="Portfolio analytics are coming soon." />}
        />
        <Route path="/meeting-center" element={<MeetingCenterPage />} />
        <Route path="/meeting-center/:id" element={<MeetingDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
