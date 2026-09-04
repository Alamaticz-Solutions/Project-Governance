import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from './AppShell';
import { PageHeader, FeedbackState } from '@appfw/pds-health-components';
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

export function AppRoot({ scaffoldReference }: { scaffoldReference: ReactNode }) {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardScreen />} />
        <Route path="projects" element={<ProjectListScreen />} />
        <Route path="projects/:projectId" element={<ProjectDetailScreen />} />
        <Route path="projects/:projectId/workspace" element={<ProjectWorkspaceScreen />} />
        <Route path="team-inbox" element={<TeamInboxScreen />} />
        <Route path="intake" element={<IntakeScreen />} />
        <Route path="notifications" element={<NotificationsScreen />} />
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

function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <FeedbackState
        kind="error"
        title="No such screen"
        detail="Check the URL or use the command palette to navigate."
      />
    </>
  );
}
