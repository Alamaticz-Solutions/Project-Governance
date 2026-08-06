import { Component, signal, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-page">
      <!-- Left Panel -->
      <div class="login-left">
        <div class="brand">
          <div class="brand-icon">
            <span class="material-icons">hub</span>
          </div>
          <div class="brand-text">
            <h1>ABC Health</h1>
            <p>Project Governance Portal</p>
          </div>
        </div>
        <div class="hero-content">
          <h2>One platform for every project from idea to go-live</h2>
          <p>Replacing 10–15 fragmented forms with a single intelligent governance workflow engine.</p>
          <div class="feature-list">
            @for (f of features; track f.icon) {
              <div class="feature-item">
                <span class="material-icons feature-icon">{{ f.icon }}</span>
                <span>{{ f.label }}</span>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Right Panel -->
      <div class="login-right">
        <div class="login-card">
          <div class="login-header">
            <h2>Welcome back</h2>
            <p>Sign in to your governance account</p>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
            <div class="form-group">
              <label for="email">Email Address <span class="required">*</span></label>
              <input
                id="email"
                type="email"
                formControlName="email"
                class="form-control"
                [class.error]="showError('email')"
                placeholder="you@abchealth.com"
                autocomplete="email"
              />
              @if (showError('email')) {
                <span class="form-error">Valid email is required</span>
              }
            </div>

            <div class="form-group">
              <label for="password">Password <span class="required">*</span></label>
              <div class="password-field">
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  class="form-control"
                  [class.error]="showError('password')"
                  placeholder="••••••••"
                  autocomplete="current-password"
                />
                <button type="button" class="toggle-pass" (click)="showPassword.set(!showPassword())">
                  <span class="material-icons">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
              @if (showError('password')) {
                <span class="form-error">Password is required</span>
              }
            </div>

            @if (errorMessage()) {
              <div class="error-alert">
                <span class="material-icons">error_outline</span>
                {{ errorMessage() }}
              </div>
            }

            <button type="submit" class="btn btn-primary btn-lg w-full" [disabled]="loading()">
              @if (loading()) {
                <span class="material-icons spinning">autorenew</span>
                Signing in...
              } @else {
                <span class="material-icons">login</span>
                Sign In
              }
            </button>
          </form>


        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      display: flex;
      min-height: 100vh;
    }

    .login-left {
      flex: 1;
      background: linear-gradient(135deg, #091E42 0%, #0052CC 60%, #00B8D9 100%);
      display: flex;
      flex-direction: column;
      padding: 48px;
      color: #fff;

      @media (max-width: 900px) { display: none; }
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 80px;
    }

    .brand-icon {
      width: 52px;
      height: 52px;
      background: rgba(255,255,255,0.15);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);

      .material-icons { font-size: 28px; }
    }

    .brand-text h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 22px;
      font-weight: 800;
      color: #fff;
    }

    .brand-text p {
      font-size: 13px;
      color: rgba(255,255,255,0.6);
    }

    .hero-content {
      max-width: 480px;

      h2 {
        font-family: 'Outfit', sans-serif;
        font-size: 36px;
        font-weight: 800;
        color: #fff;
        line-height: 1.2;
        margin-bottom: 20px;
      }

      > p {
        font-size: 16px;
        color: rgba(255,255,255,0.7);
        line-height: 1.6;
        margin-bottom: 40px;
      }
    }

    .feature-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 15px;
      color: rgba(255,255,255,0.85);
      font-weight: 500;
    }

    .feature-icon {
      width: 40px;
      height: 40px;
      background: rgba(255,255,255,0.12);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px !important;
      flex-shrink: 0;
      backdrop-filter: blur(10px);
    }

    .login-right {
      width: 480px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #F7F8FC;
      padding: 32px;

      @media (max-width: 900px) { width: 100%; }
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      background: #fff;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 8px 40px rgba(9,30,66,0.12);
    }

    .login-header {
      text-align: center;
      margin-bottom: 32px;

      h2 {
        font-family: 'Outfit', sans-serif;
        font-size: 26px;
        font-weight: 800;
        color: #172B4D;
        margin-bottom: 6px;
      }

      p {
        font-size: 14px;
        color: #6B778C;
      }
    }

    .login-form { display: flex; flex-direction: column; gap: 20px; }

    .password-field {
      position: relative;

      .form-control { padding-right: 44px; }
    }

    .toggle-pass {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: #97A0AF;
      display: flex;
      align-items: center;
      padding: 4px;
      border-radius: 4px;

      &:hover { color: #172B4D; }
      .material-icons { font-size: 18px; }
    }

    .error-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #FFEBE6;
      border: 1px solid #FFBDAD;
      border-radius: 8px;
      color: #BF2600;
      font-size: 14px;
      font-weight: 500;

      .material-icons { font-size: 18px; }
    }


    @keyframes spin { to { transform: rotate(360deg); } }
    .spinning { animation: spin 1s linear infinite; }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  features = [
    { icon: 'account_tree', label: 'End-to-end governance workflow engine' },
    { icon: 'fact_check',   label: 'Gate-based committee reviews (A → CAB)' },
    { icon: 'security',     label: 'HIPAA & ISO 27001 compliance tracking' },
    { icon: 'smart_toy',    label: 'GenAI-powered document extraction' },
    { icon: 'dashboard',    label: 'Real-time executive dashboards' },
  ];


  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  showError(field: string): boolean {
    const ctrl = this.loginForm.get(field);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.message || 'Login failed. Please try again.');
      },
    });
  }
}
