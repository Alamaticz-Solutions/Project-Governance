import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthEventsService } from './auth-events.service';

import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

export interface AppNotification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  action_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationTypeStyle {
  icon: string;
  bg: string;
  color: string;
}

const TYPE_STYLES: Record<string, NotificationTypeStyle> = {
  project_created: { icon: 'add_circle', bg: '#E3F0FF', color: '#0052CC' },
  task_assigned: { icon: 'assignment', bg: '#E3F0FF', color: '#0052CC' },
  task_completed: { icon: 'check_circle', bg: '#E3FCEF', color: '#00875A' },
  approval_required: { icon: 'help_outline', bg: '#FFF4D6', color: '#FF8B00' },
  approved: { icon: 'check_circle', bg: '#E3FCEF', color: '#00875A' },
  rejected: { icon: 'cancel', bg: '#FFEBE6', color: '#DE350B' },
  overdue: { icon: 'warning', bg: '#FFEBE6', color: '#DE350B' },
  stage_advanced: { icon: 'trending_up', bg: '#E3F0FF', color: '#0052CC' },
  comment_added: { icon: 'chat_bubble', bg: '#FFF4D6', color: '#FF8B00' },
};

const DEFAULT_STYLE: NotificationTypeStyle = { icon: 'notifications', bg: '#F0F2F7', color: '#42526E' };

export function styleForNotificationType(type: string): NotificationTypeStyle {
  return TYPE_STYLES[type] || DEFAULT_STYLE;
}

export function timeAgo(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);
  private authEvents = inject(AuthEventsService);

  private notificationsSignal = signal<AppNotification[]>([]);
  private loadingSignal = signal(false);
  private unreadCountSignal = signal(0);
  private inFlight = false;
  private hasLoadedOnce = false;
  private lastFetchedAt = 0;
  private readonly STALE_MS = 20000;

  readonly notifications = this.notificationsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly unreadCount = this.unreadCountSignal.asReadonly();

  constructor() {
    this.refresh();
    this.refreshUnreadCount();
    // The bell badge has no push channel, so poll periodically as a backstop —
    // a one-shot fetch at construction can silently miss the auth token race
    // on first login and would then never update again.
    setInterval(() => this.refreshUnreadCount(), 30000);
    this.authEvents.loggedOut$.subscribe(() => this.reset());
  }

  /** Cached: skips the network call (and the loading flicker) if the list was
   *  fetched recently, unless force=true (e.g. right after a known change). */
  refresh(force = false) {
    if (this.inFlight) return;
    if (!force && this.hasLoadedOnce && Date.now() - this.lastFetchedAt < this.STALE_MS) return;
    this.inFlight = true;
    if (!this.hasLoadedOnce) this.loadingSignal.set(true);
    this.http.get<AppNotification[]>(`${API_URL}/notifications/`).subscribe({
      next: (notifications) => {
        this.notificationsSignal.set(notifications);
        this.loadingSignal.set(false);
        this.inFlight = false;
        this.hasLoadedOnce = true;
        this.lastFetchedAt = Date.now();
      },
      error: (err) => {
        console.error('Failed to load notifications', err);
        this.loadingSignal.set(false);
        this.inFlight = false;
      }
    });
  }

  refreshUnreadCount() {
    this.http.get<{ count: number }>(`${API_URL}/notifications/unread-count`).subscribe({
      next: (res) => this.unreadCountSignal.set(res.count),
      error: (err) => console.error('Failed to load unread count', err)
    });
  }

  markAsRead(id: string) {
    const wasUnread = this.notificationsSignal().find(n => n.id === id)?.is_read === false;
    this.notificationsSignal.update(list =>
      list.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    if (wasUnread) this.unreadCountSignal.update(c => Math.max(0, c - 1));
    this.http.patch(`${API_URL}/notifications/${id}/read`, {}).subscribe({
      error: (err) => console.error('Failed to mark notification as read', err)
    });
  }

  markAllRead() {
    this.notificationsSignal.update(list => list.map(n => ({ ...n, is_read: true })));
    this.unreadCountSignal.set(0);
    this.http.post(`${API_URL}/notifications/mark-all-read`, {}).subscribe({
      error: (err) => console.error('Failed to mark all notifications as read', err)
    });
  }

  /** Clears cached state on logout so a new session never inherits a wedged
   *  in-flight flag or another user's already-fetched notifications. */
  reset() {
    this.notificationsSignal.set([]);
    this.unreadCountSignal.set(0);
    this.loadingSignal.set(false);
    this.inFlight = false;
    this.hasLoadedOnce = false;
    this.lastFetchedAt = 0;
  }
}
