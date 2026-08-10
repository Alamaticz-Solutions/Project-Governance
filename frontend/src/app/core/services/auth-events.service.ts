import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Decouples AuthService from the session-scoped cache singletons (notifications,
 * pending approvals, project list). AuthService only ever emits here; the caches
 * only ever subscribe. Neither side injects the other directly — if AuthService
 * injected the caches (or vice versa), their constructors firing an HTTP call
 * through the auth interceptor (which itself injects AuthService) would be a
 * circular DI dependency (NG0200). This service has no dependencies itself, so
 * it can't be part of any cycle.
 */
@Injectable({ providedIn: 'root' })
export class AuthEventsService {
  readonly loggedOut$ = new Subject<void>();
}
