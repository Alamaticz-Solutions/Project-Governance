import { Component, computed, inject, signal, ElementRef, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService, AppNotification, styleForNotificationType, timeAgo } from '../../../core/services/notification.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-16 flex items-center justify-between px-6 sticky top-0 z-40 transition-all"
         style="background: rgba(255,255,255,0.80); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid rgba(79,70,229,0.10); box-shadow: 0 1px 24px rgba(79,70,229,0.06), 0 1px 4px rgba(0,0,0,0.04);">

      <!-- Brand Title -->
      <div class="flex items-center gap-3">
        <div class="flex flex-col">
          <h1 class="text-[15px] font-bold tracking-tight leading-tight" style="font-family: 'Outfit', sans-serif; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Enterprise Governance Portal</h1>
          <span class="text-[10px] font-semibold tracking-widest uppercase" style="color: #94A3B8;">AI-Powered Decision Engine</span>
        </div>
      </div>

      <div class="flex items-center gap-3">

        <!-- Premium Search Bar -->
        <div class="relative flex items-center group">
          <!-- Search glow ring -->
          <div class="absolute inset-0 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 blur-sm pointer-events-none" style="background: linear-gradient(135deg, rgba(79,70,229,0.2), rgba(124,58,237,0.2));"></div>
          <span class="material-icons absolute left-3 z-10 transition-colors duration-200 text-[18px]" style="color: #94A3B8;" id="search-icon">search</span>
          <input type="text" placeholder="Search projects or members..." id="navbar-search"
                 class="relative pl-9 pr-4 py-2 w-68 text-[13px] outline-none transition-all duration-200 rounded-xl"
                 style="background: rgba(241,245,249,0.8); border: 1.5px solid rgba(226,232,240,0.8); color: #334155; width: 256px;"
                 onfocus="this.style.background='white'; this.style.borderColor='rgba(79,70,229,0.4)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)'; document.getElementById('search-icon').style.color='#4F46E5';"
                 onblur="this.style.background='rgba(241,245,249,0.8)'; this.style.borderColor='rgba(226,232,240,0.8)'; this.style.boxShadow='none'; document.getElementById('search-icon').style.color='#94A3B8';" />
          <!-- Keyboard shortcut pill -->
          <div class="absolute right-3 flex items-center gap-0.5 pointer-events-none">
            <kbd class="text-[9px] font-bold px-1.5 py-0.5 rounded" style="background: rgba(226,232,240,0.9); color: #64748B; border: 1px solid rgba(203,213,225,0.8);">⌘K</kbd>
          </div>
        </div>

        <!-- Divider -->
        <div class="h-7 w-px" style="background: rgba(226,232,240,0.9);"></div>

        <!-- Notification Bell with dropdown -->
        <div class="relative" #notifWrapper>
          <button (click)="toggleDropdown($event)" id="nav-notifications"
                  class="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 group"
                  [style.background]="dropdownOpen() ? 'rgba(79,70,229,0.10)' : 'transparent'"
                  [style.color]="dropdownOpen() ? '#4F46E5' : '#64748B'"
                  onmouseenter="this.style.background='rgba(79,70,229,0.08)'; this.style.color='#4F46E5';"
                  onmouseleave="this.style.background='transparent'; this.style.color='#64748B';"
                  title="Notifications">
            <span class="material-icons text-[21px]">notifications</span>
            @if (unreadCount() > 0) {
              <span class="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
                    style="background: #DC2626; border: 1.5px solid white; min-width: 19px; height: 17px; font-size: 10px; padding: 0 3px;">
                {{ unreadCount() > 10 ? '10+' : unreadCount() }}
              </span>
              <span class="absolute top-0 right-0 inline-flex h-2.5 w-2.5 rounded-full opacity-75 animate-ping" style="background: #DC2626;"></span>
            }
          </button>

          @if (dropdownOpen()) {
            <div class="absolute right-0 top-12 rounded-2xl overflow-hidden z-50"
                 style="width: 380px; background: rgba(15,23,42,0.95); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); box-shadow: 0 12px 40px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
              <div class="flex items-center justify-between px-4 py-3" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
                <span class="text-[14px] font-bold" style="color: #F1F5F9;">Notifications</span>
                <button (click)="markAllRead($event)" class="text-[12px] font-semibold" style="color: #818CF8;">Mark all read</button>
              </div>

              <div style="max-height: 420px; overflow-y: auto;">
                @if (notificationService.loading()) {
                  <div style="padding: 32px; text-align: center; color: #94A3B8; font-size: 13px;">Loading...</div>
                } @else if (notificationService.notifications().length === 0) {
                  <div style="padding: 32px; text-align: center; color: #94A3B8;">
                    <span class="material-icons" style="font-size: 28px;">notifications_none</span>
                    <p style="margin-top: 6px; font-size: 13px;">You're all caught up. No notifications yet.</p>
                  </div>
                } @else {
                  @for (n of notificationService.notifications(); track n.id) {
                    <div class="dropdown-notif-row" [class.unread]="!n.is_read" (click)="onNotificationClick(n)">
                      <div class="notif-icon" [style.background]="styleFor(n.notification_type).bg">
                        <span class="material-icons" style="font-size: 18px;" [style.color]="styleFor(n.notification_type).color">{{ styleFor(n.notification_type).icon }}</span>
                      </div>
                      <div style="flex:1; min-width:0;">
                        <div class="notif-title">{{ n.title }}</div>
                        <div class="notif-message">{{ n.message }}</div>
                        <div class="notif-time">{{ timeAgo(n.created_at) }}</div>
                      </div>
                      @if (!n.is_read) {
                        <div class="unread-dot"></div>
                      }
                    </div>
                  }
                }
              </div>
            </div>
          }
        </div>

        <!-- Help/Knowledge Base -->
        <button routerLink="/knowledge-base" id="nav-knowledge"
                class="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
                style="color: #64748B;"
                onmouseenter="this.style.background='rgba(79,70,229,0.08)'; this.style.color='#4F46E5';"
                onmouseleave="this.style.background='transparent'; this.style.color='#64748B';"
                title="Knowledge Base">
          <span class="material-icons text-[21px]">help_outline</span>
        </button>

        <!-- Divider -->
        <div class="h-7 w-px" style="background: rgba(226,232,240,0.9);"></div>

        <!-- Premium User Menu -->
        <div class="flex items-center gap-2.5 pl-1 cursor-pointer group">
          <!-- Avatar with gradient ring -->
          <div class="relative flex-shrink-0">
            <div class="absolute inset-0 rounded-full opacity-60 group-hover:opacity-100 transition-opacity" style="background: linear-gradient(135deg, #4F46E5, #7C3AED); transform: scale(1.18); filter: blur(3px);"></div>
            <div class="relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md" style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);">
              {{ userInitials() }}
            </div>
          </div>
          <!-- User info -->
          <div class="flex flex-col">
            <span class="text-[13px] font-semibold leading-tight transition-colors duration-200 group-hover:text-indigo-600" style="color: #1E293B;">{{ userName() }}</span>
            <span class="text-[10px] font-medium capitalize" style="color: #94A3B8;">{{ userRoleDisplay() }}</span>
          </div>
          <!-- Logout -->
          <button (click)="logout()" id="nav-logout"
                  class="ml-1 w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200"
                  style="color: #94A3B8;"
                  onmouseenter="this.style.background='rgba(220,38,38,0.08)'; this.style.color='#DC2626';"
                  onmouseleave="this.style.background='transparent'; this.style.color='#94A3B8';"
                  title="Sign Out">
            <span class="material-icons text-[19px]">logout</span>
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    @keyframes ping {
      75%, 100% { transform: scale(2); opacity: 0; }
    }
    .animate-ping { animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite; }

    .dropdown-notif-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      cursor: pointer;
      transition: background 150ms;
    }
    .dropdown-notif-row:hover { background: rgba(255,255,255,0.05); }
    .dropdown-notif-row:last-child { border-bottom: none; }
    .dropdown-notif-row.unread { background: rgba(99,102,241,0.10); }

    .notif-icon {
      width: 34px;
      height: 34px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .notif-title { font-size: 13px; font-weight: 600; color: #F1F5F9; margin-bottom: 2px; }
    .notif-message { font-size: 12px; color: #94A3B8; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .notif-time { font-size: 10.5px; color: #64748B; margin-top: 4px; font-weight: 600; }

    .unread-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #818CF8;
      flex-shrink: 0;
      margin-top: 5px;
    }
  `]
})
export class NavbarComponent {
  private authService = inject(AuthService);
  notificationService = inject(NotificationService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);

  dropdownOpen = signal(false);
  unreadCount = computed(() => this.notificationService.unreadCount());

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.notificationService.refreshUnreadCount();
    });
  }

  userName = computed(() => this.authService.userFullName());
  userInitials = computed(() => {
    const name = this.authService.userFullName();
    return name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  });
  userRoleDisplay = computed(() => {
    const role = this.authService.userRole();
    return role ? role.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : '';
  });

  styleFor = styleForNotificationType;
  timeAgo = timeAgo;

  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    const opening = !this.dropdownOpen();
    this.dropdownOpen.set(opening);
    if (opening) {
      this.notificationService.refresh();
      this.notificationService.refreshUnreadCount();
    }
  }

  markAllRead(event: MouseEvent) {
    event.stopPropagation();
    this.notificationService.markAllRead();
  }

  onNotificationClick(n: AppNotification) {
    if (!n.is_read) this.notificationService.markAsRead(n.id);
    this.dropdownOpen.set(false);
    if (n.action_url) this.router.navigateByUrl(n.action_url);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.dropdownOpen() && !this.elementRef.nativeElement.contains(event.target)) {
      this.dropdownOpen.set(false);
    }
  }

  logout() { this.authService.logout(); }
}
