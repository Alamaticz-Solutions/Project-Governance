import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from './AppShell';
import { RequireAuth } from './RequireAuth';
import { PageHeader, FeedbackState } from '@ui-kit';
import { SignInScreen } from '../features/auth/SignInScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { ProjectListScreen } from '../features/projects/ProjectListScreen';
import { ProjectDetailScreen } from '../features/projects/ProjectDetailScreen';
import { ProjectWorkspaceScreen } from '../features/workspace/ProjectWorkspaceScreen';
import { TeamInboxScreen } from '../features/team-inbox/TeamInboxScreen';
import { IntakeScreen } from '../features/intake/IntakeScreen';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { MeetingCenterScreen } from '../features/meeting-center/MeetingCenterScreen';
import { MeetingDetailScreen } from '../features/meeting-center/MeetingDetailScreen';
import { AuditScreen } from '../features/audit/AuditScreen';
import { EntityBrowserScreen } from '../features/entities/EntityBrowserScreen';
import type { GovernanceRole } from '../lib/authContext';

// Roles that can operate the gate workflow (matches the backend Rego actor set
// for gate transitions / decisions). Everyone signed in can read the portfolio.
const OPERATOR_ROLES: readonly GovernanceRole[] = [
  'admin',
  'epmo',
  'project_manager',
  'bta',
  'finance',
  'eac',
  'cab',
  'pic',
  'trc',
  'security',
  'analysis_team'
];

export function AppRoot({ scaffoldReference }: { scaffoldReference: ReactNode }) {
  return (
    <Routes>
      {/* public */}
      <Route path="/sign-in" element={<SignInScreen />} />

      {/* everything else is behind the shell + auth guard */}
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardScreen />} />
        <Route path="projects" element={<ProjectListScreen />} />
        <Route path="projects/:projectId" element={<ProjectDetailScreen />} />
        <Route
          path="projects/:projectId/workspace"
          element={
            <RequireAuth roles={OPERATOR_ROLES}>
              <ProjectWorkspaceScreen />
            </RequireAuth>
          }
        />
        {/* Dev-branch alias — notifications / inbox rows link here. */}
        <Route
          path="team-inbox/:projectId/workspace"
          element={
            <RequireAuth roles={OPERATOR_ROLES}>
              <ProjectWorkspaceScreen />
            </RequireAuth>
          }
        />
        <Route
          path="team-inbox"
          element={
            <RequireAuth roles={OPERATOR_ROLES}>
              <TeamInboxScreen />
            </RequireAuth>
          }
        />
        <Route path="intake" element={<IntakeScreen />} />
        <Route path="notifications" element={<NotificationsScreen />} />
        <Route
          path="analytics"
          element={
            <PlaceholderScreen
              title="Analytics"
              detail="Portfolio analytics are coming soon."
            />
          }
        />
        <Route path="meeting-center" element={<MeetingCenterScreen />} />
        <Route path="meeting-center/:meetingId" element={<MeetingDetailScreen />} />
        <Route path="audit" element={<AuditScreen />} />
        <Route path="entities" element={<EntityBrowserScreen />} />
        <Route path="entities/:routeSegment" element={<EntityBrowserScreen />} />
        <Route path="scaffold" element={<>{scaffoldReference}</>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function PlaceholderScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ padding: 24 }}>
      <PageHeader title={title} />
      <FeedbackState kind="info" title={`${title} — not yet available`} detail={detail} />
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ padding: 24 }}>
      <PageHeader title="Not found" />
      <FeedbackState
        kind="error"
        title="No such screen"
        detail="Check the URL, or pick a destination from the navigation."
      />
    </div>
  );
}
