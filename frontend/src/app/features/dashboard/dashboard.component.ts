import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="animate-fade-in p-6 bg-enterprise-bg min-h-full">
      <!-- Executive Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="font-display text-3xl font-bold text-gray-900 tracking-tight">Executive Dashboard</h1>
          <p class="text-sm font-medium text-gray-500 mt-1 flex items-center gap-2">
            <span class="material-icons text-sm text-green-500">fiber_manual_record</span>
            Live Portfolio Analytics — {{ today }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button class="bg-white border border-gray-200 shadow-sm text-gray-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <span class="material-icons text-[18px] text-gray-500">picture_as_pdf</span>
            Executive Summary
          </button>
          <a routerLink="/intake" class="bg-enterprise-primary hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5">
            <span class="material-icons text-[18px]">add</span>
            New Proposal
          </a>
        </div>
      </div>

      <!-- Governance KPIs Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        @for (kpi of kpis; track kpi.label) {
          <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-enterprise-soft hover:shadow-enterprise-hover transition-all duration-300 relative overflow-hidden group">
            <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-{{kpi.colorCode}}-50 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>
            <div class="flex items-start justify-between relative z-10">
              <div>
                <p class="text-sm font-semibold text-gray-500 mb-1 tracking-wide">{{ kpi.label }}</p>
                <h3 class="font-display text-4xl font-extrabold text-gray-900">{{ kpi.value }}</h3>
              </div>
              <div class="w-12 h-12 rounded-xl bg-{{kpi.colorCode}}-50 text-{{kpi.colorCode}}-600 flex items-center justify-center shadow-sm">
                <span class="material-icons text-[26px]">{{ kpi.icon }}</span>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-2 relative z-10">
              <span class="flex items-center text-xs font-bold px-2 py-0.5 rounded-full" 
                    [ngClass]="kpi.trendUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                <span class="material-icons text-[14px]">{{ kpi.trendUp ? 'trending_up' : 'trending_down' }}</span>
                <span class="ml-1">{{ kpi.trendValue }}%</span>
              </span>
              <span class="text-xs text-gray-400 font-medium">{{ kpi.trendText }}</span>
            </div>
          </div>
        }
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- Center Column (Main Data 2/3 wide) -->
        <div class="lg:col-span-2 space-y-8">
          
          <!-- AI Insights Glassmorphism Card -->
          <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-enterprise-secondary to-blue-900 p-1 shadow-xl">
            <div class="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
            <div class="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 relative z-10 text-white">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center">
                  <span class="material-icons text-indigo-200">auto_awesome</span>
                </div>
                <h3 class="font-bold text-lg">AI Governance Insights</h3>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-black/20 rounded-lg p-4 border border-white/5">
                  <p class="text-xs text-indigo-200 font-semibold mb-1 uppercase tracking-wider">Risk Prediction</p>
                  <p class="text-sm font-medium text-white">"Project Overhaul CMDB" shows a 78% likelihood of SLA breach in Gate S due to incomplete vendor documentation.</p>
                </div>
                <div class="bg-black/20 rounded-lg p-4 border border-white/5">
                  <p class="text-xs text-indigo-200 font-semibold mb-1 uppercase tracking-wider">Portfolio Optimization</p>
                  <p class="text-sm font-medium text-white">3 Active Projects overlap in "Cloud Infrastructure". Consider merging them into an Epic for 14% cost efficiency.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Active Requests / Projects Table -->
          <div class="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100 flex flex-col">
            <div class="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
              <h3 class="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span class="material-icons text-enterprise-primary">view_timeline</span>
                Portfolio Status
              </h3>
              <a routerLink="/projects" class="text-sm font-semibold text-enterprise-primary hover:text-blue-700">View All</a>
            </div>
            <div class="p-0 overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-white border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                    <th class="px-6 py-4">Initiative</th>
                    <th class="px-6 py-4">Priority</th>
                    <th class="px-6 py-4">Workflow Stage</th>
                    <th class="px-6 py-4">SLA Risk</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  @for (p of activeProjects; track p.id) {
                    <tr class="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                      <td class="px-6 py-4">
                        <div class="font-bold text-gray-800 group-hover:text-enterprise-primary transition-colors">{{ p.name }}</div>
                        <div class="text-xs font-medium text-gray-500">{{ p.dept }}</div>
                      </td>
                      <td class="px-6 py-4">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                              [ngClass]="getPriorityClasses(p.priority)">
                          {{ p.priority }}
                        </span>
                      </td>
                      <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 rounded-full" [ngClass]="p.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'"></div>
                          <span class="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{{ p.stage }}</span>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <div class="flex flex-col gap-1.5">
                          <div class="flex justify-between text-xs font-bold text-gray-600">
                            <span>Progress</span>
                            <span>{{ p.progress }}%</span>
                          </div>
                          <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-1000"
                                 [ngClass]="p.progress < 30 ? 'bg-red-500' : (p.progress < 70 ? 'bg-blue-500' : 'bg-green-500')"
                                 [style.width.%]="p.progress"></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Right Column (Context & Approvals) -->
        <div class="space-y-8">
          
          <!-- Pending Reviews (My Tasks) -->
          <div class="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100">
            <div class="px-6 py-5 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
              <h3 class="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span class="material-icons text-orange-500">pending_actions</span>
                My Tasks & Reviews
              </h3>
            </div>
            <div class="p-4 space-y-3">
              @for (task of pendingReviews; track task.id) {
                <div class="p-4 rounded-xl border border-gray-100 hover:border-blue-200 bg-white hover:bg-blue-50/30 transition-all cursor-pointer group shadow-sm hover:shadow-md">
                  <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{{ task.type }}</span>
                    <span class="text-[11px] font-medium text-gray-400">{{ task.timeAgo }}</span>
                  </div>
                  <h4 class="font-semibold text-gray-800 text-sm mb-1 leading-snug group-hover:text-enterprise-primary">{{ task.title }}</h4>
                  <p class="text-xs text-gray-500">{{ task.requester }}</p>
                </div>
              }
            </div>
          </div>

          <!-- Risk Dashboard Summary -->
          <div class="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100">
            <div class="px-6 py-5 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
              <h3 class="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span class="material-icons text-red-500">gpp_maybe</span>
                Executive Risk Heatmap
              </h3>
            </div>
            <div class="p-6 space-y-4">
              @for (risk of riskLevels; track risk.label) {
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-3 h-3 rounded-full shadow-sm" [ngClass]="risk.bgClass"></div>
                    <span class="text-sm font-semibold text-gray-700">{{ risk.label }}</span>
                  </div>
                  <span class="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{{ risk.count }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Today's Meetings -->
          <div class="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100 relative overflow-hidden">
            <div class="absolute right-0 top-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-0"></div>
            <div class="px-6 py-5 relative z-10 border-b border-gray-100">
              <h3 class="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span class="material-icons text-indigo-500">groups</span>
                Today's Meetings
              </h3>
            </div>
            <div class="p-4 space-y-3 relative z-10">
              <div class="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div class="flex flex-col items-center justify-center p-2 bg-indigo-50 rounded-lg min-w-[50px] border border-indigo-100 text-indigo-700">
                  <span class="text-xs font-bold uppercase">10:00</span>
                  <span class="text-[10px] font-bold">AM</span>
                </div>
                <div>
                  <h4 class="text-sm font-bold text-gray-800">EAC Architecture Committee</h4>
                  <p class="text-xs text-gray-500 font-medium">3 proposals strictly scheduled</p>
                </div>
              </div>
              <div class="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div class="flex flex-col items-center justify-center p-2 bg-orange-50 rounded-lg min-w-[50px] border border-orange-100 text-orange-700">
                  <span class="text-xs font-bold uppercase">2:30</span>
                  <span class="text-[10px] font-bold">PM</span>
                </div>
                <div>
                  <h4 class="text-sm font-bold text-gray-800">BTA Alignment Review</h4>
                  <p class="text-xs text-gray-500 font-medium">Weekly project intake sync</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: []
})
export class DashboardComponent implements OnInit {
  today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  kpis = [
    { label: 'Total Portfolio Budget', value: '$84M', icon: 'account_balance', colorCode: 'blue', trendValue: 4.2, trendUp: true, trendText: 'vs last quarter' },
    { label: 'Pending Approvals', value: '18', icon: 'timelapse', colorCode: 'orange', trendValue: 12, trendUp: false, trendText: 'bottleneck detected' },
    { label: 'Active Proposals', value: '34', icon: 'lightbulb', colorCode: 'indigo', trendValue: 8.5, trendUp: true, trendText: 'new intake requests' },
    { label: 'Critical Risks', value: '3', icon: 'warning_amber', colorCode: 'red', trendValue: 2, trendUp: false, trendText: 'escalations required' },
  ];

  activeProjects = [
    { id: '1', name: 'Global ERP Synchronization', dept: 'Finance Tech', priority: 'High', stage: 'EAC Review', progress: 65, status: 'active' },
    { id: '2', name: 'Azure Data Lake Migration', dept: 'Data & Analytics', priority: 'Critical', stage: 'PIC Review', progress: 85, status: 'active' },
    { id: '3', name: 'AI Chatbot for Patient Triage', dept: 'Innovation', priority: 'Medium', stage: 'BTA Review', progress: 20, status: 'active' },
    { id: '4', name: 'Legacy Mainframe Decomm', dept: 'Infrastructure', priority: 'Low', stage: 'Completed', progress: 100, status: 'completed' },
  ];

  pendingReviews = [
    { id: 'r1', type: 'EAC Review', title: 'Global ERP Synchronization', requester: 'Submitted by Finance', timeAgo: '2h ago' },
    { id: 'r2', type: 'BTA Review', title: 'AI Chatbot for Patient Triage', requester: 'Submitted by R&D', timeAgo: '5h ago' },
    { id: 'r3', type: 'PIC Review', title: 'Azure Data Lake Migration', requester: 'Pending CFO Sign-off', timeAgo: '1d ago' },
  ];

  riskLevels = [
    { label: 'Critical Escalations', count: 3, bgClass: 'bg-red-500' },
    { label: 'High Alert', count: 8, bgClass: 'bg-orange-500' },
    { label: 'Moderate Watch', count: 14, bgClass: 'bg-blue-500' },
    { label: 'Stable Portfolio', count: 105, bgClass: 'bg-green-500' },
  ];

  getPriorityClasses(p: string): string {
    switch (p.toLowerCase()) {
      case 'critical': return 'bg-red-50 text-red-700 border-red-200';
      case 'high': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'medium': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  }

  private dashboardService = inject(DashboardService);
  private authService = inject(AuthService);

  ngOnInit(): void {}
}
