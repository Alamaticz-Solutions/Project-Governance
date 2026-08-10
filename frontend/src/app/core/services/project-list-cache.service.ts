import { Injectable, signal, inject } from '@angular/core';
import { ProjectService } from './project.service';
import { AuthEventsService } from './auth-events.service';
import { Project } from '../models/models';

const STALE_MS = 30000;
const INFLIGHT_TIMEOUT_MS = 15000;

/**
 * Shared, app-lifetime cache for the "My Requests" project list.
 * Previously ProjectListComponent held this as component-local state and refetched
 * from scratch (with a blocking spinner) every time the route was revisited, since
 * Angular's default RouteReuseStrategy destroys/recreates the component on every
 * navigation. Caching it here (a root singleton, not tied to component lifecycle)
 * lets the list render instantly from cache on revisit while refreshing in the background.
 */
@Injectable({ providedIn: 'root' })
export class ProjectListCacheService {
  private projectService = inject(ProjectService);
  private authEvents = inject(AuthEventsService);

  private itemsSignal = signal<Project[]>([]);
  private loadingSignal = signal(false);
  private inFlight = false;
  private hasLoadedOnce = false;
  private lastFetchedAt = 0;
  private fetchStartedAt = 0;

  readonly items = this.itemsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  constructor() {
    this.authEvents.loggedOut$.subscribe(() => this.reset());
  }

  /** Cached: skips the network call (and the loading flicker) if the list was
   *  fetched recently, unless force=true. Also self-heals if a previous fetch
   *  never resolved (e.g. interrupted by a logout mid-request) by treating a
   *  stuck in-flight flag older than INFLIGHT_TIMEOUT_MS as stale. */
  refresh(force = false) {
    if (this.inFlight && Date.now() - this.fetchStartedAt < INFLIGHT_TIMEOUT_MS) return;
    if (!force && this.hasLoadedOnce && Date.now() - this.lastFetchedAt < STALE_MS) return;

    this.inFlight = true;
    this.fetchStartedAt = Date.now();
    if (!this.hasLoadedOnce) this.loadingSignal.set(true);

    this.projectService.getProjects({ page_size: 100 }).subscribe({
      next: (res) => {
        this.itemsSignal.set(res.items);
        this.loadingSignal.set(false);
        this.inFlight = false;
        this.hasLoadedOnce = true;
        this.lastFetchedAt = Date.now();
      },
      error: (err) => {
        console.error('Failed to load projects', err);
        this.loadingSignal.set(false);
        this.inFlight = false;
      }
    });
  }

  /** Clears cached state on logout so a new session never inherits a wedged
   *  in-flight flag or another user's already-fetched project list. */
  reset() {
    this.itemsSignal.set([]);
    this.loadingSignal.set(false);
    this.inFlight = false;
    this.hasLoadedOnce = false;
    this.lastFetchedAt = 0;
  }
}
