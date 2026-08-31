import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ai-risk',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fade-in p-6 bg-enterprise-bg min-h-full">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="font-display text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <span class="material-icons text-rose-500 text-[32px]">coronavirus</span>
            AI Risk Detection Engine
          </h1>
          <p class="text-sm font-medium text-gray-500 mt-1">Real-time dependency graphs, security vulnerabilities, and vendor risk prediction.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white rounded-2xl p-6 shadow-enterprise-soft border border-gray-100 flex flex-col items-center justify-center min-h-[400px]">
             <span class="material-icons text-7xl text-gray-200 mb-4 animate-pulse">hub</span>
             <h3 class="font-bold text-xl text-gray-800">No Critical Risks Detected</h3>
             <p class="text-gray-500 mt-2 text-center max-w-sm">The AI Risk engine continuously monitors the portfolio. Currently, all operational boundaries are secure.</p>
          </div>

          <div class="bg-white rounded-2xl p-6 shadow-enterprise-soft border border-gray-100 flex flex-col h-full">
            <h3 class="font-bold text-gray-800 text-lg border-b border-gray-100 pb-2 mb-4 flex items-center gap-2">
                <span class="material-icons text-orange-500">warning</span> Medium Level Alerts
            </h3>
            <ul class="space-y-4">
                <li class="p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <p class="text-sm font-bold text-orange-800 mb-1">Vendor Contract Renewal Overlap</p>
                    <p class="text-xs text-orange-600">Project "Workday HR Mod" depends on an Oracle API contract that expires midway through Phase 2. AI suggests renegotiation prior to PIC approval.</p>
                </li>
            </ul>
          </div>
      </div>
    </div>
  `
})
export class AiRiskComponent {}
