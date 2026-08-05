import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fade-in p-6 bg-enterprise-bg min-h-full">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="font-display text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <span class="material-icons text-enterprise-primary text-[32px]">pie_chart</span>
            Portfolio Analytics & Reporting
          </h1>
          <p class="text-sm font-medium text-gray-500 mt-1">Generate AI insight reports, view compliance, and audit trails.</p>
        </div>
        <div class="flex gap-3">
            <button class="bg-white border border-gray-200 shadow-sm text-gray-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors">
            <span class="material-icons text-gray-400 text-[18px]">calendar_today</span> This Quarter
            </button>
            <button class="bg-enterprise-primary hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5">
            <span class="material-icons text-[18px]">download</span> Export Report
            </button>
        </div>
      </div>

      <!-- Main Visualizations Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        
        <!-- Generated Reports Panel -->
        <div class="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100 p-6">
            <h3 class="font-bold text-gray-800 text-base mb-4 flex items-center gap-2 border-b border-gray-100 pb-2">
                <span class="material-icons text-indigo-500">article</span>
                AI Generated Reports
            </h3>
            <div class="space-y-3">
                <div class="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer border border-gray-50 transition-colors group">
                    <div class="flex items-center gap-3">
                        <span class="material-icons text-red-400 text-[20px]">picture_as_pdf</span>
                        <div>
                            <p class="text-sm font-bold text-gray-800">Q3 Executive Summary</p>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Generated 10 mins ago</p>
                        </div>
                    </div>
                    <span class="material-icons text-gray-400 group-hover:text-enterprise-primary">download</span>
                </div>
                <div class="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer border border-gray-50 transition-colors group">
                    <div class="flex items-center gap-3">
                        <span class="material-icons text-green-400 text-[20px]">description</span>
                        <div>
                            <p class="text-sm font-bold text-gray-800">Compliance Audit Trail</p>
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Generated Yesterday</p>
                        </div>
                    </div>
                    <span class="material-icons text-gray-400 group-hover:text-enterprise-primary">download</span>
                </div>
            </div>
            <button class="w-full mt-4 bg-indigo-50 text-indigo-700 border border-indigo-100 py-2 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                <span class="material-icons text-[18px]">auto_awesome</span> Generate New
            </button>
        </div>

        <!-- Budget Allocation Chart Stub -->
        <div class="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100 p-6 lg:col-span-2 relative overflow-hidden flex flex-col justify-between">
            <h3 class="font-bold text-gray-800 text-base flex items-center gap-2 border-b border-gray-100 pb-2">
                <span class="material-icons text-blue-500">bar_chart</span>
                Budget Allocation by Department
            </h3>
            
            <div class="flex-1 mt-4 flex items-center justify-center">
                <!-- Simulated Bar Chart using HTML/CSS classes -->
                <div class="flex items-end gap-6 h-48 w-full justify-center opacity-90">
                    <div class="w-16 bg-blue-500 rounded-t-lg relative group h-[80%] shadow-sm">
                        <span class="absolute -top-6 w-full text-center text-xs font-bold text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">$14M</span>
                    </div>
                    <div class="w-16 bg-indigo-400 rounded-t-lg relative group h-[45%] shadow-sm">
                        <span class="absolute -top-6 w-full text-center text-xs font-bold text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">$8M</span>
                    </div>
                    <div class="w-16 bg-purple-500 rounded-t-lg relative group h-[60%] shadow-sm">
                        <span class="absolute -top-6 w-full text-center text-xs font-bold text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">$10M</span>
                    </div>
                    <div class="w-16 bg-blue-300 rounded-t-lg relative group h-[20%] shadow-sm">
                        <span class="absolute -top-6 w-full text-center text-xs font-bold text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">$3M</span>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-center gap-6 mt-4 border-t border-gray-100 pt-4">
                <div class="text-center"><p class="text-xs font-bold text-gray-400 uppercase tracking-widest">IT Ops</p></div>
                <div class="text-center"><p class="text-xs font-bold text-gray-400 uppercase tracking-widest">HR/Finance</p></div>
                <div class="text-center"><p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Clinical</p></div>
                <div class="text-center"><p class="text-xs font-bold text-gray-400 uppercase tracking-widest">Innovation</p></div>
            </div>
        </div>

      </div>

      <!-- Advanced System Audit Stream -->
      <div class="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100">
        <div class="px-6 py-5 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl flex justify-between items-center">
            <h3 class="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span class="material-icons text-gray-700">history</span>
                Global Governance Audit Stream
            </h3>
            <span class="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded inline-flex items-center gap-1"><span class="material-icons text-[14px]">check_circle</span> Immutable Log Active</span>
        </div>
        
        <table class="w-full text-left">
            <thead>
                <tr class="bg-white border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                    <th class="px-6 py-4">Timestamp (UTC)</th>
                    <th class="px-6 py-4">User</th>
                    <th class="px-6 py-4">Event Topic</th>
                    <th class="px-6 py-4">Cryptographic Hash</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-50 font-mono text-sm text-gray-600">
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">2026-08-03 14:02:11</td>
                    <td class="px-6 py-4 text-blue-600">svc_bta_automation</td>
                    <td class="px-6 py-4">Automatic Transition to <span class="bg-blue-50 text-blue-700 px-1 rounded">EAC</span> routed</td>
                    <td class="px-6 py-4 text-[10px] text-gray-400">9c1b-4f9e-a12...</td>
                </tr>
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">2026-08-03 10:15:00</td>
                    <td class="px-6 py-4 text-blue-600">admin&#64;abchealth.com</td>
                    <td class="px-6 py-4">Modified SLA Parameters in <span class="bg-purple-50 text-purple-700 px-1 rounded">EPMO Ruleset</span></td>
                    <td class="px-6 py-4 text-[10px] text-gray-400">77da-2c49-f83...</td>
                </tr>
            </tbody>
        </table>
      </div>
    </div>
  `
})
export class AnalyticsComponent {}
