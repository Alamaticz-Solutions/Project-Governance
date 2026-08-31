import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'auth',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell.component').then(m => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        title: 'Dashboard — ABC Governance Portal',
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/list/project-list.component').then(m => m.ProjectListComponent),
        title: 'All Projects — ABC Governance Portal',
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('./features/projects/detail/project-detail.component').then(m => m.ProjectDetailComponent),
        title: 'Project Detail — ABC Governance Portal',
      },
      {
        path: 'workspace/:id',
        loadComponent: () =>
          import('./features/review-workspace/review-workspace.component').then(m => m.ReviewWorkspaceComponent),
        title: 'Review Workspace — ABC Governance Portal',
      },
      {
        path: 'intake',
        loadComponent: () =>
          import('./features/intake/intake.component').then(m => m.IntakeComponent),
        title: 'New Proposal — ABC Governance Portal',
      },
      {
        path: 'gate-review',
        loadComponent: () =>
          import('./features/gate-review/gate-review.component').then(m => m.GateReviewComponent),
        title: 'Gate Review Center — ABC Governance Portal',
      },
      {
        path: 'bta-review',
        loadComponent: () =>
          import('./features/bta-review/bta-review.component').then(m => m.BtaReviewComponent),
        title: 'BTA Review — ABC Governance Portal',
      },
      {
        path: 'epmo-review',
        loadComponent: () =>
          import('./features/epmo-review/epmo-review.component').then(m => m.EpmoReviewComponent),
        title: 'EPMO Review — ABC Governance Portal',
      },
      {
        path: 'finance-review',
        loadComponent: () =>
          import('./features/finance-review/finance-review.component').then(m => m.FinanceReviewComponent),
        title: 'Finance Review — ABC Governance Portal',
      },
      {
        path: 'prepare-eac',
        loadComponent: () =>
          import('./features/eac-review/prepare-eac.component').then(m => m.PrepareEacComponent),
        title: 'Prepare for EAC — ABC Governance Portal',
      },
      {
        path: 'eac-meeting',
        loadComponent: () =>
          import('./features/eac-review/eac-meeting.component').then(m => m.EacMeetingComponent),
        title: 'EAC Meeting — ABC Governance Portal',
      },
      {
        path: 'prepare-pic',
        loadComponent: () =>
          import('./features/pic-review/prepare-pic.component').then(m => m.PreparePicComponent),
        title: 'Prepare for PIC — ABC Governance Portal',
      },
      {
        path: 'pic-meeting',
        loadComponent: () =>
          import('./features/pic-review/pic-meeting.component').then(m => m.PicMeetingComponent),
        title: 'PIC Meeting — ABC Governance Portal',
      },
      {
        path: 'team-inbox',
        loadComponent: () =>
          import('./features/team-inbox/team-inbox.component').then(m => m.TeamInboxComponent),
        title: 'Team Inbox — ABC Governance Portal',
      },
      {
        path: 'knowledge-base',
        loadComponent: () =>
          import('./features/knowledge-base/knowledge-base.component').then(m => m.KnowledgeBaseComponent),
        title: 'Knowledge Base — ABC Governance Portal',
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.component').then(m => m.NotificationsComponent),
        title: 'Notifications — ABC Governance Portal',
      },
      {
        path: 'meeting-center',
        loadComponent: () =>
          import('./features/meeting-center/meeting-center.component').then(m => m.MeetingCenterComponent),
        title: 'Meeting Center — ABC Governance Portal',
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/analytics/analytics.component').then(m => m.AnalyticsComponent),
        title: 'Analytics — ABC Governance Portal',
      },
      {
        path: 'ai-risk',
        loadComponent: () =>
          import('./features/ai-risk/ai-risk.component').then(m => m.AiRiskComponent),
        title: 'AI Risk Engine — ABC Governance Portal',
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
