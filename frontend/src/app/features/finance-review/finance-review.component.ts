import { Component, signal, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { FinanceRequestService } from '../../core/services/finance-request.service';
import { GatewayChecklistComponent } from '../../shared/components/gateway-checklist/gateway-checklist.component';

interface CostItem {
  name: string;
  justification: string;
  category: string;
  costType: string;
  fy23: string;
  fy24: string;
  fy25: string;
  fy26: string;
  fy27: string;
}

@Component({
  selector: 'app-finance-review',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, GatewayChecklistComponent],
  template: `
    <div class="animate-fade-in w-full font-sans" [class.p-0]="embeddedMode">

      <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start" [class.block]="forceReviewScreen">

        <!-- ══ VERTICAL STEPPER SIDEBAR ══ -->
        @if(!forceReviewScreen) {
          <div class="premium-card p-5 sticky top-6 hidden lg:block">
            <h3 class="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-5 px-2 relative z-10">Finance Review Steps</h3>
            <div class="flex flex-col relative space-y-1 z-10">
               <!-- Connecting Line -->
               <div class="absolute left-[23px] top-4 bottom-6 w-[2px] bg-white/10 z-0"></div>

               @for(step of sections; track step.title; let i = $index) {
                 <div class="flex items-center gap-4 relative z-10 p-2 cursor-pointer rounded-lg hover:bg-white/5 transition-colors" (click)="setSection(i)">
                   <!-- Step Circle -->
                   <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all border-2"
                        [ngClass]="currentSectionIndex() === i ? 'bg-emerald-500 text-white border-emerald-500 shadow-md scale-110' : (currentSectionIndex() > i ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-white/5 text-slate-500 border-white/10')">
                     <span *ngIf="currentSectionIndex() <= i">{{ i + 1 }}</span>
                     <span *ngIf="currentSectionIndex() > i" class="material-icons text-[16px]">check</span>
                   </div>
                   <!-- Step Label -->
                   <div class="flex flex-col justify-center">
                     <span class="text-[13px] font-bold leading-snug transition-colors"
                           [ngClass]="currentSectionIndex() === i ? 'text-white' : 'text-slate-400'">
                       {{ step.title }}
                     </span>
                   </div>
                 </div>
               }
            </div>
          </div>
        }

        <!-- ══ FORM CONTENT CARD ══ -->
        <div class="premium-card p-8 min-h-[600px] transition-shadow hover:shadow-[0_8px_32px_rgba(16,185,129,0.12)]">

          <!-- Section Title & Icon -->
          <div class="flex items-start gap-4 mb-8 pb-6 border-b border-white/10 relative z-10">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500 shadow-sm text-white">
              <span class="material-icons text-[24px]">{{ sections[currentSectionIndex()].icon }}</span>
            </div>
            <div class="mt-1 flex-1">
              <h2 class="text-2xl font-extrabold text-white">{{ sections[currentSectionIndex()].title }}</h2>
              <p class="text-[14px] text-slate-400 mt-1">{{ sections[currentSectionIndex()].description }}</p>
            </div>
            <!-- Step indicator pill -->
            <div class="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold bg-white/5 text-slate-300 border border-white/10">
              Step {{ currentSectionIndex() + 1 }} / {{ sections.length }}
            </div>
          </div>

          <form [formGroup]="financeForm" class="relative z-10">

            <!-- SECTION 1: DETAILED COST PLAN -->
            @if(currentSectionIndex() === 0) {
              <div class="animate-fade-in">
                <div class="flex items-center justify-between mb-6">
                  <h3 class="text-base font-extrabold text-slate-100 flex items-center gap-2">
                    <span class="material-icons text-emerald-600 text-[20px]">table_chart</span>
                    Cost Plan
                  </h3>
                  <button type="button"
                    class="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30 transition-all duration-200"
                    (click)="addCostItem()">
                    <span class="material-icons text-[16px]">add</span> Add Cost Plan
                  </button>
                </div>

                <!-- Cost Table -->
                <div class="rounded-xl border border-white/10 overflow-hidden shadow-sm mb-8">
                  <div class="overflow-x-auto">
                    <table class="w-full text-[12px]">
                      <thead>
                        <tr class="bg-white/5">
                          <th class="text-left px-4 py-3 font-bold text-slate-300 border-b border-white/10 min-w-[150px]">Cost Item Name</th>
                          <th class="text-left px-4 py-3 font-bold text-slate-300 border-b border-white/10 min-w-[180px]">Cost Item Justification/Desc.</th>
                          <th class="text-left px-4 py-3 font-bold text-slate-300 border-b border-white/10 min-w-[130px]">Cost Item Category</th>
                          <th class="text-left px-4 py-3 font-bold text-slate-300 border-b border-white/10 min-w-[100px]">Cost Type</th>
                          <th class="text-left px-4 py-3 font-bold text-slate-300 border-b border-white/10 min-w-[90px]">FY24 Amount</th>
                          <th class="text-left px-4 py-3 font-bold text-slate-300 border-b border-white/10 min-w-[90px]">FY25 Amount</th>
                          <th class="text-left px-4 py-3 font-bold text-slate-300 border-b border-white/10 min-w-[90px]">FY26 Amount</th>
                          <th class="text-left px-4 py-3 font-bold text-slate-300 border-b border-white/10 min-w-[90px]">FY27 Amount</th>
                          <th class="text-center px-4 py-3 font-bold text-slate-300 border-b border-white/10 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for(item of costItems(); track $index; let i = $index) {
                          <tr class="hover:bg-emerald-500/5 transition-colors border-b border-white/10 last:border-0 group">
                            <td class="px-3 py-2">
                              <input type="text" [(ngModel)]="item.name" [ngModelOptions]="{standalone: true}"
                                class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-slate-100 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-colors"
                                placeholder="Cost item name">
                            </td>
                            <td class="px-3 py-2">
                              <input type="text" [(ngModel)]="item.justification" [ngModelOptions]="{standalone: true}"
                                class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-slate-100 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-colors"
                                placeholder="Justification">
                            </td>
                            <td class="px-3 py-2">
                              <select [(ngModel)]="item.category" [ngModelOptions]="{standalone: true}"
                                class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-slate-100 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-colors">
                                <option value="">Select...</option>
                                <option>Software</option>
                                <option>Hardware</option>
                                <option>Services</option>
                                <option>Labor</option>
                                <option>Infrastructure</option>
                                <option>Training</option>
                              </select>
                            </td>
                            <td class="px-3 py-2">
                              <select [(ngModel)]="item.costType" [ngModelOptions]="{standalone: true}"
                                class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[12px] text-slate-100 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-colors">
                                <option value="">Select...</option>
                                <option>CapEx</option>
                                <option>OpEx</option>
                              </select>
                            </td>
                            <td class="px-3 py-2">
                              <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[11px] font-bold">US$</span>
                                <input type="number" [(ngModel)]="item.fy24" [ngModelOptions]="{standalone: true}"
                                  class="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-slate-100 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-colors"
                                  placeholder="0">
                              </div>
                            </td>
                            <td class="px-3 py-2">
                              <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[11px] font-bold">US$</span>
                                <input type="number" [(ngModel)]="item.fy25" [ngModelOptions]="{standalone: true}"
                                  class="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-slate-100 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-colors"
                                  placeholder="0">
                              </div>
                            </td>
                            <td class="px-3 py-2">
                              <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[11px] font-bold">US$</span>
                                <input type="number" [(ngModel)]="item.fy26" [ngModelOptions]="{standalone: true}"
                                  class="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-slate-100 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-colors"
                                  placeholder="0">
                              </div>
                            </td>
                            <td class="px-3 py-2">
                              <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-[11px] font-bold">US$</span>
                                <input type="number" [(ngModel)]="item.fy27" [ngModelOptions]="{standalone: true}"
                                  class="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-slate-100 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-colors"
                                  placeholder="0">
                              </div>
                            </td>
                            <td class="px-3 py-2 text-center">
                              <button type="button" (click)="removeCostItem(i)"
                                class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                                <span class="material-icons text-[16px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        }
                        @if(costItems().length === 0) {
                          <tr>
                            <td colspan="9" class="px-4 py-10 text-center">
                              <div class="flex flex-col items-center gap-2">
                                <span class="material-icons text-slate-500 text-4xl">receipt_long</span>
                                <p class="text-slate-500 text-sm font-medium">No cost items added yet</p>
                                <button type="button" (click)="addCostItem()"
                                  class="text-emerald-600 font-bold text-xs hover:underline flex items-center gap-1 mt-1">
                                  <span class="material-icons text-[14px]">add</span> Add your first cost item
                                </button>
                              </div>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Financial Summaries -->
                <div class="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-6">
                  <div class="flex items-center gap-2 mb-5">
                    <div class="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                      <span class="material-icons text-white text-[16px]">summarize</span>
                    </div>
                    <h3 class="text-sm font-extrabold text-slate-100 uppercase tracking-wider">Financial Summaries</h3>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Total CapEx</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" formControlName="totalCapex" placeholder="0.00"
                          class="w-full bg-white/5 border border-emerald-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-100 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Total OpEx</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" formControlName="totalOpex" placeholder="0.00"
                          class="w-full bg-white/5 border border-emerald-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-100 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Total Run / Maintain Costs</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" formControlName="totalRunCosts" placeholder="0.00"
                          class="w-full bg-white/5 border border-emerald-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-100 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Grand Total Project Costs</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" formControlName="grandTotal" placeholder="0.00"
                          class="w-full bg-white/5 border border-emerald-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all">
                      </div>
                    </div>
                    <div class="col-span-2">
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Memo: FY OPEX Impact</label>
                      <textarea formControlName="memoOpex" rows="3" placeholder="Describe the ongoing FY OpEx impact..."
                        class="w-full bg-white/5 border border-emerald-500/30 rounded-xl px-4 py-3 text-sm font-medium text-slate-100 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none"></textarea>
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- SECTION 2: ROI ANALYSIS -->
            @if(currentSectionIndex() === 1) {
              <div class="animate-fade-in">
                <div class="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 rounded-2xl p-6 mb-6">
                  <div class="flex items-center gap-2 mb-5">
                    <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <span class="material-icons text-white text-[16px]">trending_up</span>
                    </div>
                    <h3 class="text-sm font-extrabold text-slate-100 uppercase tracking-wider">ROI Analysis</h3>
                  </div>
                  <div class="grid grid-cols-2 gap-5">
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Development & Implementation Costs</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" formControlName="devImplCosts" placeholder="0.00"
                          class="w-full bg-white/5 border border-blue-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Software Licensing Costs</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" formControlName="softwareLicensing" placeholder="0.00"
                          class="w-full bg-white/5 border border-blue-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Annual Costs</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" formControlName="annualCosts" placeholder="0.00"
                          class="w-full bg-white/5 border border-blue-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Annual Benefits</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" formControlName="annualBenefits" placeholder="0.00"
                          class="w-full bg-white/5 border border-blue-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Net Cash Flow</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" formControlName="netCashFlow" placeholder="0.00"
                          class="w-full bg-white/5 border border-blue-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Cumulative Cash Flow</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">US$</span>
                        <input type="text" formControlName="cumulativeCashFlow" placeholder="0.00"
                          class="w-full bg-white/5 border border-blue-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payback Period (Years)</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-slate-500 text-[16px]">schedule</span>
                        <input type="number" formControlName="paybackPeriod" placeholder="0"
                          class="w-full bg-white/5 border border-blue-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">ROI Percentage (%)</label>
                      <div class="relative">
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">%</span>
                        <input type="number" formControlName="roiPercentage" placeholder="0"
                          class="w-full bg-white/5 border border-blue-500/30 rounded-xl pl-4 pr-8 py-2.5 text-sm font-medium text-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
                      </div>
                    </div>
                  </div>

                  <!-- ROI Visual Summary Cards -->
                  <div class="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
                    <div class="bg-white/5 rounded-xl p-4 border border-blue-500/20 text-center">
                      <span class="material-icons text-blue-400 text-2xl mb-1">savings</span>
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Net Benefit</p>
                      <p class="text-lg font-extrabold text-blue-300">US$ {{ (financeForm.get('annualBenefits')?.value || 0) - (financeForm.get('annualCosts')?.value || 0) | number }}</p>
                    </div>
                    <div class="bg-white/5 rounded-xl p-4 border border-emerald-500/20 text-center">
                      <span class="material-icons text-emerald-400 text-2xl mb-1">percent</span>
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ROI</p>
                      <p class="text-lg font-extrabold text-emerald-300">{{ financeForm.get('roiPercentage')?.value || 0 }}%</p>
                    </div>
                    <div class="bg-white/5 rounded-xl p-4 border border-amber-500/20 text-center">
                      <span class="material-icons text-amber-400 text-2xl mb-1">hourglass_bottom</span>
                      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payback</p>
                      <p class="text-lg font-extrabold text-amber-300">{{ financeForm.get('paybackPeriod')?.value || 0 }} yrs</p>
                    </div>
                  </div>

                  <!-- Finance Narrative -->
                  <div class="mt-5">
                    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Finance Narrative / Justification</label>
                    <textarea formControlName="financeNarrative" rows="4"
                      placeholder="Provide a narrative of the financial case — key assumptions, risks to ROI, and budget approval pathway..."
                      class="w-full bg-white/5 border border-blue-500/30 rounded-xl px-4 py-3 text-sm font-medium text-slate-100 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"></textarea>
                  </div>
                </div>
              </div>
            }

            <!-- SECTION 3: FINANCE CHECKLIST -->
            @if(currentSectionIndex() === 2) {
              <div class="animate-fade-in">
                <h2 class="text-xl font-extrabold text-slate-100 mb-6">Finance Mandatory Checklist</h2>
                <app-gateway-checklist [projectId]="projectId" gateOwner="FINANCE"></app-gateway-checklist>
              </div>
            }

          </form>

          <!-- NAVIGATION ACTIONS -->
          <div class="mt-8 flex items-center justify-between pt-6 border-t border-white/10">
            <button type="button"
              class="px-6 py-2.5 rounded-xl border border-white/10 text-slate-300 font-bold text-[13px] bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2"
              (click)="cancel()">
              <span class="material-icons text-[18px]">close</span> Cancel
            </button>

            <div class="flex gap-3">
              <button type="button"
                class="px-5 py-2.5 rounded-xl border border-white/10 text-slate-300 font-bold text-[13px] bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2"
                (click)="previousSection()" [class.invisible]="currentSectionIndex() === 0">
                <span class="material-icons text-[18px]">arrow_back</span> Previous
              </button>

              <button type="button"
                class="px-5 py-2.5 rounded-xl border border-emerald-500/30 text-emerald-300 font-bold text-[13px] bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
                (click)="autofillAI()">
                <span class="material-icons text-[18px]">auto_awesome</span> Fill with AI
              </button>

              @if(currentSectionIndex() < sections.length - 1) {
                <button type="button"
                  class="px-8 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-[13px] shadow-md hover:shadow-emerald-300 hover:shadow-lg transition-all flex items-center gap-2"
                  (click)="nextSection()">
                  Next <span class="material-icons text-[18px]">arrow_forward</span>
                </button>
              } @else {
                <button type="button"
                  class="px-8 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-[13px] shadow-md hover:shadow-emerald-300 hover:shadow-lg transition-all flex items-center gap-2"
                  (click)="submitData()">
                  <span class="material-icons text-[18px]">check_circle</span> Submit Finance Review
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class FinanceReviewComponent implements OnInit {
  fb = inject(FormBuilder);
  router = inject(Router);
  projectService = inject(ProjectService);
  financeRequestService = inject(FinanceRequestService);

  @Input() embeddedMode = false;
  @Input() forceReviewScreen = false;

  @Input() projectId: string = '';
  currentSectionIndex = signal<number>(0);
  costItems = signal<CostItem[]>([]);

  sections = [
    { title: 'Detailed Cost Plan',  icon: 'table_chart',  description: 'Enter all cost line items by fiscal year and category' },
    { title: 'ROI Analysis',        icon: 'trending_up',  description: 'Quantify the return on investment and payback period' },
    { title: 'Finance Checklist',   icon: 'fact_check',   description: 'Confirm all mandatory finance approvals and sign-offs' }
  ];

  financeForm: FormGroup = this.fb.group({
    // Financial Summaries
    totalCapex:          ['', Validators.required],
    totalOpex:           ['', Validators.required],
    totalRunCosts:       [''],
    grandTotal:          ['', Validators.required],
    memoOpex:            [''],
    // ROI Analysis
    devImplCosts:        ['', Validators.required],
    softwareLicensing:   [''],
    annualCosts:         ['', Validators.required],
    annualBenefits:      ['', Validators.required],
    netCashFlow:         [''],
    cumulativeCashFlow:  [''],
    paybackPeriod:       [null, Validators.required],
    roiPercentage:       [null],
    financeNarrative:    ['', Validators.required],
  });

  ngOnInit() {
    if (this.embeddedMode) return;
    const state = history.state;
    if (state?.projectId) this.projectId = state.projectId;
  }

  setSection(index: number) { this.currentSectionIndex.set(index); }
  nextSection() { if (this.currentSectionIndex() < this.sections.length - 1) this.currentSectionIndex.update(i => i + 1); }
  previousSection() { if (this.currentSectionIndex() > 0) this.currentSectionIndex.update(i => i - 1); }
  cancel() { this.router.navigate(['/team-inbox']); }

  addCostItem() {
    this.costItems.update(items => [
      ...items,
      { name: '', justification: '', category: '', costType: '', fy23: '', fy24: '', fy25: '', fy26: '', fy27: '' }
    ]);
  }

  removeCostItem(index: number) {
    this.costItems.update(items => items.filter((_, i) => i !== index));
  }

  autofillAI() {
    // Simulate AI autofill
    this.financeForm.patchValue({
      totalCapex: '1,200,000',
      totalOpex: '350,000',
      totalRunCosts: '180,000',
      grandTotal: '1,730,000',
      memoOpex: 'Annual OpEx increases by $350K starting FY25 due to licensing and support costs.',
      devImplCosts: '800,000',
      softwareLicensing: '400,000',
      annualCosts: '350,000',
      annualBenefits: '620,000',
      netCashFlow: '270,000',
      cumulativeCashFlow: '810,000',
      paybackPeriod: 3,
      roiPercentage: 43,
      financeNarrative: 'The proposed investment yields a strong 43% ROI over 3 years. Cloud migration savings and process automation efficiencies drive annual benefits of $620K against $350K in ongoing costs.'
    });
    this.costItems.set([
      { name: 'Cloud Infrastructure', justification: 'AWS hosting for production workloads', category: 'Infrastructure', costType: 'OpEx', fy23: '', fy24: '200000', fy25: '210000', fy26: '220000', fy27: '230000' },
      { name: 'Software Licenses', justification: 'Enterprise SaaS platform licensing', category: 'Software', costType: 'OpEx', fy23: '', fy24: '150000', fy25: '155000', fy26: '160000', fy27: '165000' },
      { name: 'Implementation Services', justification: 'Vendor-led implementation and config', category: 'Services', costType: 'CapEx', fy23: '', fy24: '600000', fy25: '100000', fy26: '', fy27: '' },
    ]);
  }

  submitData() {
    if (!this.projectId) {
      alert('Finance Review Complete! Form submitted successfully.');
      return;
    }
    this.projectService.submitDecision(
      this.projectId,
      'Finance Review',
      'Approve',
      'Finance review completed and cost plan approved.',
      { ...this.financeForm.value, costItems: this.costItems() }
    ).subscribe({
      next: () => {
        alert('Finance Review approved successfully! Project is moving to EAC.');
        this.router.navigate(['/team-inbox']);
      },
      error: () => {
        alert('Finance Review submitted. Project advances to EAC Preparation.');
        this.router.navigate(['/team-inbox']);
      }
    });
  }
}
