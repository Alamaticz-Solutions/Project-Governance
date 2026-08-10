import { Injectable, signal, inject } from '@angular/core';
import { ProjectService } from './project.service';
import { AuthEventsService } from './auth-events.service';

const STALE_MS = 30000;
const INFLIGHT_TIMEOUT_MS = 15000;

/**
 * Single shared cache for GET /projects/approvals/pending.
 * Previously each of the 5 team-specific *RequestService classes (BTA/EAC/PIC/EPMO/Finance)
 * fired this same request independently — up to 8 duplicate calls per page load once the
 * sidebar badges are counted too. This service fetches once per refresh() and lets every
 * team-specific service derive its filtered view from the same in-memory list.
 */
@Injectable({ providedIn: 'root' })
export class PendingApprovalsService {
  private projectService = inject(ProjectService);
  private authEvents = inject(AuthEventsService);

  private tasksSignal = signal<any[]>([]);
  private loadingSignal = signal(false);
  private inFlight = false;
  private hasLoadedOnce = false;
  private lastFetchedAt = 0;
  private fetchStartedAt = 0;

  readonly tasks = this.tasksSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  constructor() {
    // Eager first fetch, matching the previous per-service auto-fetch-on-construction
    // behavior (e.g. the sidebar badge counts used to trigger this indirectly).
    this.refresh();
    this.authEvents.loggedOut$.subscribe(() => this.reset());
  }

  /** Cached: skips the network call if fetched recently, unless force=true.
   *  Self-heals a wedged in-flight flag from an interrupted previous fetch
   *  (e.g. a logout mid-request) once it's older than INFLIGHT_TIMEOUT_MS. */
  refresh(force = false) {
    if (this.inFlight && Date.now() - this.fetchStartedAt < INFLIGHT_TIMEOUT_MS) return;
    if (!force && this.hasLoadedOnce && Date.now() - this.lastFetchedAt < STALE_MS) return;

    this.inFlight = true;
    this.fetchStartedAt = Date.now();
    if (!this.hasLoadedOnce) this.loadingSignal.set(true);

    this.projectService.getPendingTasks().subscribe({
      next: (tasks) => {
        this.tasksSignal.set(tasks);
        this.loadingSignal.set(false);
        this.inFlight = false;
        this.hasLoadedOnce = true;
        this.lastFetchedAt = Date.now();
      },
      error: (err) => {
        console.error('Failed to load pending approvals', err);
        this.loadingSignal.set(false);
        this.inFlight = false;
      }
    });
  }

  removeTask(projectId: string, type?: string) {
    this.tasksSignal.update(tasks => tasks.filter(t => !(t.projectId === projectId && (!type || t.type === type))));
  }

  /** Clears cached state on logout so a new session never inherits a wedged
   *  in-flight flag or another user's already-fetched task list. */
  reset() {
    this.tasksSignal.set([]);
    this.loadingSignal.set(false);
    this.inFlight = false;
    this.hasLoadedOnce = false;
    this.lastFetchedAt = 0;
  }
}
