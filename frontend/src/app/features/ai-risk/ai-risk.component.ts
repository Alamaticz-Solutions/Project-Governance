import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ai-risk',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fade-in min-h-[calc(100vh-4rem)] bg-[#0f172a] text-slate-100 relative overflow-hidden font-sans pb-10">
      <!-- Deep Gradient Background -->
      <div class="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] z-0"></div>
      <div class="absolute top-0 left-0 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-3xl mix-blend-screen pointer-events-none transform -translate-x-1/2 -translate-y-1/2"></div>
      <div class="absolute bottom-0 right-0 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-3xl mix-blend-screen pointer-events-none transform translate-x-1/3 translate-y-1/3"></div>

      <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="font-display text-3xl font-bold text-white tracking-tight flex items-center gap-3 drop-shadow-md">
              <span class="material-icons text-rose-400 text-[32px]">coronavirus</span>
              AI Risk Detection Engine
            </h1>
            <p class="text-sm font-medium text-slate-400 mt-1">Real-time dependency graphs, security vulnerabilities, and vendor risk prediction.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white/5 backdrop-blur-md rounded-2xl p-6 premium-shadow border border-white/10 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
               <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>
               <span class="material-icons text-7xl text-slate-600 mb-4 animate-pulse">hub</span>
               <h3 class="font-bold text-xl text-white drop-shadow-md">No Critical Risks Detected</h3>
               <p class="text-slate-400 mt-2 text-center max-w-sm">The AI Risk engine continuously monitors the portfolio. Currently, all operational boundaries are secure.</p>
            </div>

            <div class="bg-white/5 backdrop-blur-md rounded-2xl p-6 premium-shadow border border-white/10 flex flex-col h-full relative overflow-hidden">
              <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>
              <h3 class="font-bold text-white text-lg border-b border-white/10 pb-2 mb-4 flex items-center gap-2 drop-shadow-md">
                  <span class="material-icons text-orange-400">warning</span> Medium Level Alerts
              </h3>
              <ul class="space-y-4">
                  <li class="p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
                      <p class="text-sm font-bold text-orange-300 mb-1 drop-shadow-sm">Vendor Contract Renewal Overlap</p>
                      <p class="text-xs text-orange-200/80">Project "Workday HR Mod" depends on an Oracle API contract that expires midway through Phase 2. AI suggests renegotiation prior to PIC approval.</p>
                  </li>
              </ul>
            </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .premium-shadow {
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(225, 29, 72, 0.1);
    }
  `]
})
export class AiRiskComponent {}
