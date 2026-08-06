import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { User, AuthTokens } from '../models/models';

import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;
const TOKEN_KEY = 'gov_access_token';
const REFRESH_KEY = 'gov_refresh_token';
const USER_KEY = 'gov_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _currentUser = signal<User | null>(this.loadStoredUser());
  private _isAuthenticated = signal<boolean>(!!this.getToken());

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly userRole = computed(() => this._currentUser()?.role ?? null);
  readonly userFullName = computed(() => this._currentUser()?.full_name ?? '');

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<AuthTokens> {
    const body = new URLSearchParams();
    body.set('username', email);
    body.set('password', password);

    return this.http.post<AuthTokens>(`${API_URL}/auth/login`, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).pipe(
      tap(response => this.handleAuthSuccess(response)),
      catchError(this.handleError)
    );
  }

  register(payload: {
    email: string; username: string; full_name: string;
    password: string; role?: string; department?: string;
  }): Observable<User> {
    return this.http.post<User>(`${API_URL}/auth/register`, payload)
      .pipe(catchError(this.handleError));
  }

  refreshToken(): Observable<AuthTokens> {
    const refresh_token = this.getRefreshToken();
    return this.http.post<AuthTokens>(`${API_URL}/auth/refresh`, { refresh_token }).pipe(
      tap(response => this.handleAuthSuccess(response)),
      catchError(() => { this.logout(); return throwError(() => new Error('Session expired')); })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  hasRole(role: string | string[]): boolean {
    const userRole = this._currentUser()?.role;
    if (!userRole) return false;
    return Array.isArray(role) ? role.includes(userRole) : userRole === role;
  }

  isAdmin(): boolean { return this.hasRole('admin'); }
  isEPMO(): boolean  { return this.hasRole(['admin', 'epmo']); }

  private handleAuthSuccess(response: AuthTokens): void {
    localStorage.setItem(TOKEN_KEY, response.access_token);
    localStorage.setItem(REFRESH_KEY, response.refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this._currentUser.set(response.user);
    this._isAuthenticated.set(true);
  }

  private loadStoredUser(): User | null {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  }

  private handleError(error: HttpErrorResponse) {
    const message = error.error?.detail || error.message || 'An error occurred';
    return throwError(() => new Error(message));
  }
}
