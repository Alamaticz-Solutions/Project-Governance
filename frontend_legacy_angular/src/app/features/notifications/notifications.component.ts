import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fade-in">
      <div class="page-header flex items-center justify-between">
        <div>
          <h1 class="page-title">Notifications</h1>
          <p class="page-subtitle">{{ unreadCount }} unread notifications</p>
        </div>
        <button class="btn btn-secondary btn-sm">
          <span class="material-icons">done_all</span> Mark All Read
        </button>
      </div>

      <div class="card">
        <div style="display:flex;flex-direction:column;gap:0">
          @for (n of notifications; track n.id) {
            <div class="notif-row" [class.unread]="!n.read">
              <div class="notif-icon" [style.background]="n.iconBg">
                <span class="material-icons" [style.color]="n.iconColor">{{ n.icon }}</span>
              </div>
              <div style="flex:1;min-width:0">
                <div class="notif-title">{{ n.title }}</div>
                <div class="notif-message">{{ n.message }}</div>
                <div class="notif-time">{{ n.time }}</div>
              </div>
              @if (!n.read) {
                <div class="unread-dot"></div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notif-row {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 16px 20px;
      border-bottom: 1px solid #F0F2F7;
      transition: background 200ms;
      &:hover { background: #F7F8FC; }
      &:last-child { border-bottom: none; }
      &.unread { background: #F0F5FF; }
    }

    .notif-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      .material-icons { font-size: 20px; }
    }

    .notif-title { font-size: 14px; font-weight: 600; color: #172B4D; margin-bottom: 4px; }
    .notif-message { font-size: 13px; color: #6B778C; line-height: 1.4; }
    .notif-time { font-size: 11px; color: #97A0AF; margin-top: 6px; font-weight: 600; }

    .unread-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #0052CC;
      flex-shrink: 0;
      margin-top: 6px;
    }
  `]
})
export class NotificationsComponent {
  notifications = [
    { id:'1', title:'Gate S Approved', message:'ServiceNow CMDB Overhaul — Gate S has been approved by the Service Transition team.', time:'2 hours ago', icon:'check_circle', iconBg:'#E3FCEF', iconColor:'#00875A', read:false },
    { id:'2', title:'Action Required: Gate G Needs Info', message:'Workday Payroll Enhancement — PIC committee has requested additional budget justification for Gate G.', time:'4 hours ago', icon:'help_outline', iconBg:'#FFF4D6', iconColor:'#FF8B00', read:false },
    { id:'3', title:'New Project Submitted', message:'AI Patient Scheduling POC has been submitted by K. Rodriguez. VCR gate has been triggered.', time:'1 day ago', icon:'add_circle', iconBg:'#E3F0FF', iconColor:'#0052CC', read:false },
    { id:'4', title:'Vendor Risk Flagged', message:'AI Patient Scheduling POC — Vendor SOC 2 report has expired. Re-certification required before Gate H can proceed.', time:'1 day ago', icon:'warning', iconBg:'#FFEBE6', iconColor:'#DE350B', read:true },
    { id:'5', title:'Task Assigned to You', message:'EAC Architecture Review for Multi-Cloud Hosting Migration has been assigned to you.', time:'2 days ago', icon:'assignment', iconBg:'#E3F0FF', iconColor:'#0052CC', read:true },
  ];

  get unreadCount() { return this.notifications.filter(n => !n.read).length; }
}
