import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { BtaRequestService } from '../../../core/services/bta-request.service';
import { EacRequestService } from '../../../core/services/eac-request.service';
import { FinanceRequestService } from '../../../core/services/finance-request.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  badge?: number;
  roles?: string[];
}

const NAV_MAIN: NavItem[] = [
  { label: 'Overview Dashboard', icon: 'dashboard', route: '/dashboard' },
  { label: 'New Request', icon: 'add_circle', route: '/intake' },
  { label: 'My Requests', icon: 'list_alt', route: '/projects' },
];

const NAV_ADMIN: NavItem[] = [
  { label: 'Workflow Config', icon: 'account_tree', route: '/admin/config', roles: ['admin'] },
  { label: 'User Management', icon: 'manage_accounts', route: '/admin/users', roles: ['admin'] },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="flex flex-col h-full w-64 relative overflow-hidden" style="background: linear-gradient(180deg, #0D0F1A 0%, #111827 100%); border-right: 1px solid rgba(255,255,255,0.06);">

      <!-- Ambient glow background effects -->
      <div class="absolute top-0 left-0 w-full h-64 pointer-events-none" style="background: radial-gradient(ellipse at 30% 0%, rgba(79,70,229,0.18) 0%, transparent 70%); z-index: 0;"></div>
      <div class="absolute bottom-0 right-0 w-48 h-48 pointer-events-none" style="background: radial-gradient(ellipse at 100% 100%, rgba(124,58,237,0.12) 0%, transparent 70%); z-index: 0;"></div>

      <!-- Premium Logo Section -->
      <div class="relative z-10 flex items-center gap-3 px-5 py-5 min-h-[72px]" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
        <!-- Logo icon with glow ring -->
        <div class="relative flex-shrink-0">
          <div class="absolute inset-0 rounded-xl blur-md opacity-70" style="background: linear-gradient(135deg, #4F46E5, #7C3AED); transform: scale(1.15);"></div>
          <div class="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);">
            <span class="material-icons text-white" style="font-size: 20px;">account_tree</span>
          </div>
        </div>
        <div class="flex flex-col overflow-hidden">
          <span class="text-sm font-bold text-white whitespace-nowrap tracking-wide" style="font-family: 'Outfit', sans-serif; letter-spacing: 0.01em;">Governance Portal</span>
          <span class="text-[10px] font-bold tracking-widest uppercase" style="background: linear-gradient(90deg, #818CF8, #A78BFA); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Enterprise AI</span>
        </div>
      </div>

      <!-- Scrollable Navigation -->
      <div class="flex-1 overflow-y-auto py-4 relative z-10 custom-scrollbar">

        <!-- Workspace Section -->
        <div class="mb-5">
          <span class="px-5 pb-2 block text-[10px] font-bold tracking-widest uppercase" style="color: rgba(148,163,184,0.5);">Workspace</span>
          <ul class="space-y-0.5">
            @for (item of navMain; track item.route) {
              <li>
                <a [routerLink]="item.route" routerLinkActive #rla="routerLinkActive"
                   class="mx-3 px-3 py-2.5 rounded-xl flex items-center gap-3 text-[13px] font-semibold transition-all duration-200 group relative"
                   [style]="rla.isActive
                     ? 'background: linear-gradient(135deg, rgba(79,70,229,0.25) 0%, rgba(124,58,237,0.15) 100%); color: white; border: 1px solid rgba(79,70,229,0.3); box-shadow: 0 2px 12px rgba(79,70,229,0.15);'
                     : 'color: rgba(148,163,184,0.8); border: 1px solid transparent;'">
                  <!-- Active left accent bar -->
                  @if(rla.isActive) {
                    <div class="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style="background: linear-gradient(180deg, #818CF8, #A78BFA);"></div>
                  }
                  <span class="material-icons transition-all duration-200"
                        style="font-size: 19px;"
                        [style.color]="rla.isActive ? '#818CF8' : ''"
                        [class]="rla.isActive ? '' : 'group-hover:text-[#818CF8]'">{{ item.icon }}</span>
                  <span class="flex-1">{{ item.label }}</span>
                </a>
              </li>
            }
          </ul>
        </div>

        <!-- Governance Engine Section -->
        <div class="mb-5">
          <span class="px-5 pb-2 block text-[10px] font-bold tracking-widest uppercase" style="color: rgba(148,163,184,0.5);">Governance Engine</span>
          <ul class="space-y-0.5">
            @for (item of navGovernance(); track item.route) {
              <li>
                <a [routerLink]="item.route" routerLinkActive #rla2="routerLinkActive"
                   class="mx-3 px-3 py-2.5 rounded-xl flex items-center gap-3 text-[13px] font-semibold transition-all duration-200 group relative"
                   [style]="rla2.isActive
                     ? 'background: linear-gradient(135deg, rgba(79,70,229,0.25) 0%, rgba(124,58,237,0.15) 100%); color: white; border: 1px solid rgba(79,70,229,0.3); box-shadow: 0 2px 12px rgba(79,70,229,0.15);'
                     : 'color: rgba(148,163,184,0.8); border: 1px solid transparent;'">
                  @if(rla2.isActive) {
                    <div class="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style="background: linear-gradient(180deg, #818CF8, #A78BFA);"></div>
                  }
                  <span class="material-icons transition-all duration-200"
                        style="font-size: 19px;"
                        [style.color]="rla2.isActive ? '#818CF8' : ''"
                        [class]="rla2.isActive ? '' : 'group-hover:text-[#818CF8]'">{{ item.icon }}</span>
                  <span class="flex-1">{{ item.label }}</span>
                  @if (item.badge) {
                    <span class="text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center" style="background: linear-gradient(135deg, #4F46E5, #7C3AED); box-shadow: 0 2px 8px rgba(79,70,229,0.4);">{{ item.badge }}</span>
                  }
                </a>
              </li>
            }
          </ul>
        </div>


      </div>

      <!-- User Footer Profile Box -->
      <div class="relative z-10 p-4" style="border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.2);">
        <div class="flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 cursor-pointer group" style="border: 1px solid transparent;" onmouseenter="this.style.background='rgba(255,255,255,0.06)'; this.style.borderColor='rgba(255,255,255,0.08)';" onmouseleave="this.style.background='transparent'; this.style.borderColor='transparent';">
          <!-- Avatar with gradient ring -->
          <div class="relative flex-shrink-0">
            <div class="absolute inset-0 rounded-full blur-sm" style="background: linear-gradient(135deg, #4F46E5, #7C3AED); transform: scale(1.2); opacity: 0.6;"></div>
            <div class="relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background: linear-gradient(135deg, #4F46E5, #7C3AED);">
              {{ userInitials() }}
            </div>
          </div>
          <div class="overflow-hidden flex-1">
            <span class="block text-sm font-semibold text-white truncate">{{ userName() }}</span>
            <span class="block text-[11px] capitalize" style="color: rgba(148,163,184,0.7);">{{ userRole() }}</span>
          </div>
          <span class="material-icons text-sm opacity-0 group-hover:opacity-100 transition-opacity" style="color: rgba(148,163,184,0.6); font-size: 16px;">settings</span>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 3px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(79,70,229,0.3); border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(79,70,229,0.5); }
  `]
})
export class SidebarComponent {
  navMain = NAV_MAIN;
  navAdmin = NAV_ADMIN;

  private authService = inject(AuthService);
  private btaRequestService = inject(BtaRequestService);
  private eacRequestService = inject(EacRequestService);
  private financeRequestService = inject(FinanceRequestService);
  router = inject(Router);

  navGovernance = computed(() => {
    const role = this.authService.userRole();
    let count = 0;
    if (role === 'bta' || role === 'admin') {
      count += this.btaRequestService.requests().length;
    }
    if (role === 'eac' || role === 'admin') {
      count += this.eacRequestService.requests().length;
    }
    if (role === 'finance' || role === 'admin') {
      count += this.financeRequestService.requests().length;
    }
    return [
      { label: 'Pending Reviews',    icon: 'pending_actions', route: '/team-inbox', badge: count },
      { label: 'Meeting Center',     icon: 'groups',          route: '/meeting-center' },
      { label: 'AI Risk Engine',     icon: 'policy',          route: '/ai-risk' },
    ];
  });

  isAdmin = computed(() => this.authService.hasRole('admin'));
  userName = computed(() => this.authService.userFullName());
  userRole = computed(() => this.authService.userRole()?.replace(/_/g, ' ') ?? '');
  userInitials = computed(() => {
    const name = this.authService.userFullName();
    return name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  });
}
