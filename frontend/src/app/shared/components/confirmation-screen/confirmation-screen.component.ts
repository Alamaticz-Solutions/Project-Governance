import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-confirmation-screen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="success-screen animate-fade-in">
      <div class="success-icon-wrapper" [style.background]="iconBg">
        <span class="material-icons success-icon" [style.color]="iconColor">{{ iconName }}</span>
      </div>
      <h2 class="success-title">{{ title }}</h2>
      <p class="success-message">{{ message }}</p>
      @if (subMessage) {
        <p class="success-submessage">{{ subMessage }}</p>
      }
      <div class="success-actions">
        @if (showReturnButton) {
          <button type="button" class="btn-return" (click)="onReturn()">{{ returnLabel }}</button>
        }
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styles: [`
    .success-screen {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; max-width: 620px; margin: 40px auto; padding: 56px 40px;
      background: #FFFFFF; border: 1px solid rgba(226,232,240,0.8); border-radius: 20px;
      box-shadow: 0 20px 50px rgba(16,24,40,0.12); font-family: 'Inter', sans-serif;
    }
    .success-icon-wrapper {
      width: 88px; height: 88px; border-radius: 50%;
      background: linear-gradient(135deg, #E3FCEF 0%, #D1FAE5 100%);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 28px; box-shadow: 0 8px 24px rgba(16,185,129,0.2);
    }
    .success-icon { font-size: 52px; color: #10B981; }
    .success-title {
      margin: 0 0 12px; font-size: 26px; font-weight: 800; color: #172B4D;
      font-family: 'Outfit', sans-serif; letter-spacing: -0.3px;
    }
    .success-message { margin: 0; color: #505F79; font-size: 15px; line-height: 1.6; max-width: 440px; }
    .success-submessage { margin: 10px 0 0; color: #6B778C; font-size: 13px; line-height: 1.6; max-width: 440px; }
    .success-actions { margin-top: 32px; display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
    .btn-return {
      padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px;
      background: linear-gradient(135deg, #10B981, #059669); color: white; border: none;
      cursor: pointer; box-shadow: 0 4px 14px rgba(16,185,129,0.3); transition: all 0.2s;
    }
    .btn-return:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(16,185,129,0.4); }
  `]
})
export class ConfirmationScreenComponent {
  private router = inject(Router);

  @Input() title = 'Completed Successfully!';
  @Input() message = 'Your request has been processed.';
  @Input() subMessage = '';
  @Input() returnLabel = 'Return to Pending Reviews';
  @Input() returnRoute = '/team-inbox';
  @Input() showReturnButton = true;
  @Input() iconName = 'check_circle';
  @Input() iconColor = '#10B981';
  @Input() iconBg = 'linear-gradient(135deg, #E3FCEF 0%, #D1FAE5 100%)';

  onReturn() {
    this.router.navigate([this.returnRoute]);
  }
}
