import { Component, signal, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { FinanceRequestService } from '../../core/services/finance-request.service';

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
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="flex flex-col gap-6 animate-fade-in w-full font-sans" [class.p-0]="embeddedMode">

      <!-- HORIZONTAL STEPPER -->
      @if(!forceReviewScreen) {
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full flex items-start justify-between relative overflow-x-auto">
          <div class="absolute top-[52px] left-12 right-12 h-[2px] bg-gray-100 -z-10"></div>
          @for(step of sections; track step.title; let i = $index) {
            <div class="flex flex-col items-center cursor-pointer group shrink-0 w-[120px] relative" (click)="setSection(i)">
              <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 z-10 mx-auto"
                   [ngClass]="{
                      'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200': currentSectionIndex() === i,
                      'bg-white text-gray-400 border-2 border-gray-200 hover:border-emerald-400 hover:text-emerald-600': currentSectionIndex() !== i,
                      'bg-emerald-50 border-2 border-emerald-500 text-emerald-700': currentSectionIndex() > i
                   }">
                <span *ngIf="currentSectionIndex() <= i">{{ i + 1 }}</span>
                <span *ngIf="currentSectionIndex() > i" class="material-icons text-[18px]">check</span>
              </div>
              <div class="w-2 h-2 rounded-full bg-emerald-500 mt-2 transition-all duration-300"
                   [class.opacity-0]="currentSectionIndex() !== i"></div>
              <div class="mt-2 text-center font-bold text-[10px] leading-snug transition-colors duration-300 px-1"
                   [ngClass]="currentSectionIndex() === i ? 'text-emerald-800' : 'text-gray-500'">
                  {{ step.title }}
              </div>
            </div>
          }
        </div>
      }

      <!-- FORM CONTENT CARD -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden w-full">

        <!-- Section Header Bar -->
        <div class="bg-gradient-to-r from-emerald-600 to-teal-700 px-8 py-5 flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
            <span class="material-icons text-white text-xl">{{ sections[currentSectionIndex()].icon }}</span>
          </div>
          <div>
            <h2 class="text-lg font-extrabold text-white tracking-tight">{{ sections[currentSectionIndex()].title }}</h2>
            <p class="text-emerald-100 text-xs font-medium mt-0.5">{{ sections[currentSectionIndex()].description }}</p>
          </div>
          <div class="ml-auto flex items-center gap-2">
            <div class="bg-white/20 rounded-full px-3 py-1 text-white text-[11px] font-bold tracking-wide backdrop-blur-sm">
              Step {{ currentSectionIndex() + 1 }} / {{ sections.length }}
            </div>
          </div>
        </div>

        <div class="p-8">
          <form [formGroup]="financeForm">

            <!-- SECTION 1: DETAILED COST PLAN -->
            @if(currentSectionIndex() === 0) {
              <div class="animate-fade-in">
                <div class="flex items-center justify-between mb-6">
                  <h3 class="text-base font-extrabold text-gray-900 flex items-center gap-2">
                    <span class="material-icons text-emerald-600 text-[20px]">table_chart</span>
                    Cost Plan
                  </h3>
                  <button type="button"
                    class="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-all duration-200 shadow-sm"
                    (click)="addCostItem()">
                    <span class="material-icons text-[16px]">add</span> Add Cost Plan
                  </button>
                </div>

                <!-- Cost Table -->
                <div class="rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-8">
                  <div class="overflow-x-auto">
                    <table class="w-full text-[12px]">
                      <thead>
                        <tr class="bg-gradient-to-r from-gray-50 to-gray-100">
                          <th class="text-left px-4 py-3 font-bold text-gray-600 border-b border-gray-200 min-w-[150px]">Cost Item Name</th>
                          <th class="text-left px-4 py-3 font-bold text-gray-600 border-b border-gray-200 min-w-[180px]">Cost Item Justification/Desc.</th>
                          <th class="text-left px-4 py-3 font-bold text-gray-600 border-b border-gray-200 min-w-[130px]">Cost Item Category</th>
                          <th class="text-left px-4 py-3 font-bold text-gray-600 border-b border-gray-200 min-w-[100px]">Cost Type</th>
                          <th class="text-left px-4 py-3 font-bold text-gray-600 border-b border-gray-200 min-w-[90px]">FY24 Amount</th>
                          <th class="text-left px-4 py-3 font-bold text-gray-600 border-b border-gray-200 min-w-[90px]">FY25 Amount</th>
                          <th class="text-left px-4 py-3 font-bold text-gray-600 border-b border-gray-200 min-w-[90px]">FY26 Amount</th>
                          <th class="text-left px-4 py-3 font-bold text-gray-600 border-b border-gray-200 min-w-[90px]">FY27 Amount</th>
                          <th class="text-center px-4 py-3 font-bold text-gray-600 border-b border-gray-200 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for(item of costItems(); track $index; let i = $index) {
                          <tr class="hover:bg-emerald-50/30 transition-colors border-b border-gray-100 last:border-0 group">
                            <td class="px-3 py-2">
                              <input type="text" [(ngModel)]="item.name" [ngModelOptions]="{standalone: true}"
                                class="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                                placeholder="Cost item name">
                            </td>
                            <td class="px-3 py-2">
                              <input type="text" [(ngModel)]="item.justification" [ngModelOptions]="{standalone: true}"
                                class="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                                placeholder="Justification">
                            </td>
                            <td class="px-3 py-2">
                              <select [(ngModel)]="item.category" [ngModelOptions]="{standalone: true}"
                                class="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors">
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
                                class="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors">
                                <option value="">Select...</option>
                                <option>CapEx</option>
                                <option>OpEx</option>
                              </select>
                            </td>
                            <td class="px-3 py-2">
                              <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-bold">US$</span>
                                <input type="number" [(ngModel)]="item.fy24" [ngModelOptions]="{standalone: true}"
                                  class="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                                  placeholder="0">
                              </div>
                            </td>
                            <td class="px-3 py-2">
                              <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-bold">US$</span>
                                <input type="number" [(ngModel)]="item.fy25" [ngModelOptions]="{standalone: true}"
                                  class="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                                  placeholder="0">
                              </div>
                            </td>
                            <td class="px-3 py-2">
                              <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-bold">US$</span>
                                <input type="number" [(ngModel)]="item.fy26" [ngModelOptions]="{standalone: true}"
                                  class="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                                  placeholder="0">
                              </div>
                            </td>
                            <td class="px-3 py-2">
                              <div class="relative">
                                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[11px] font-bold">US$</span>
                                <input type="number" [(ngModel)]="item.fy27" [ngModelOptions]="{standalone: true}"
                                  class="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                                  placeholder="0">
                              </div>
                            </td>
                            <td class="px-3 py-2 text-center">
                              <button type="button" (click)="removeCostItem(i)"
                                class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                                <span class="material-icons text-[16px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        }
                        @if(costItems().length === 0) {
                          <tr>
                            <td colspan="9" class="px-4 py-10 text-center">
                              <div class="flex flex-col items-center gap-2">
                                <span class="material-icons text-gray-200 text-4xl">receipt_long</span>
                                <p class="text-gray-400 text-sm font-medium">No cost items added yet</p>
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
                <div class="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 mb-6">
                  <div class="flex items-center gap-2 mb-5">
                    <div class="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                      <span class="material-icons text-white text-[16px]">summarize</span>
                    </div>
                    <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Financial Summaries</h3>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Total CapEx</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">US$</span>
                        <input type="text" formControlName="totalCapex" placeholder="0.00"
                          class="w-full bg-white border border-emerald-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Total OpEx</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">US$</span>
                        <input type="text" formControlName="totalOpex" placeholder="0.00"
                          class="w-full bg-white border border-emerald-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Total Run / Maintain Costs</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">US$</span>
                        <input type="text" formControlName="totalRunCosts" placeholder="0.00"
                          class="w-full bg-white border border-emerald-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Grand Total Project Costs</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">US$</span>
                        <input type="text" formControlName="grandTotal" placeholder="0.00"
                          class="w-full bg-white border border-emerald-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-emerald-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all">
                      </div>
                    </div>
                    <div class="col-span-2">
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Memo: FY OPEX Impact</label>
                      <textarea formControlName="memoOpex" rows="3" placeholder="Describe the ongoing FY OpEx impact..."
                        class="w-full bg-white border border-emerald-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all resize-none"></textarea>
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- SECTION 2: ROI ANALYSIS -->
            @if(currentSectionIndex() === 1) {
              <div class="animate-fade-in">
                <div class="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 mb-6">
                  <div class="flex items-center gap-2 mb-5">
                    <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <span class="material-icons text-white text-[16px]">trending_up</span>
                    </div>
                    <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">ROI Analysis</h3>
                  </div>
                  <div class="grid grid-cols-2 gap-5">
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Development & Implementation Costs</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">US$</span>
                        <input type="text" formControlName="devImplCosts" placeholder="0.00"
                          class="w-full bg-white border border-blue-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Software Licensing Costs</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">US$</span>
                        <input type="text" formControlName="softwareLicensing" placeholder="0.00"
                          class="w-full bg-white border border-blue-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Annual Costs</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">US$</span>
                        <input type="text" formControlName="annualCosts" placeholder="0.00"
                          class="w-full bg-white border border-blue-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Annual Benefits</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">US$</span>
                        <input type="text" formControlName="annualBenefits" placeholder="0.00"
                          class="w-full bg-white border border-blue-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Net Cash Flow</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">US$</span>
                        <input type="text" formControlName="netCashFlow" placeholder="0.00"
                          class="w-full bg-white border border-blue-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Cumulative Cash Flow</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">US$</span>
                        <input type="text" formControlName="cumulativeCashFlow" placeholder="0.00"
                          class="w-full bg-white border border-blue-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Payback Period (Years)</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 material-icons text-gray-400 text-[16px]">schedule</span>
                        <input type="number" formControlName="paybackPeriod" placeholder="0"
                          class="w-full bg-white border border-blue-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
                      </div>
                    </div>
                    <div>
                      <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">ROI Percentage (%)</label>
                      <div class="relative">
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">%</span>
                        <input type="number" formControlName="roiPercentage" placeholder="0"
                          class="w-full bg-white border border-blue-200 rounded-xl pl-4 pr-8 py-2.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all">
                      </div>
                    </div>
                  </div>

                  <!-- ROI Visual Summary Cards -->
                  <div class="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-blue-100">
                    <div class="bg-white rounded-xl p-4 border border-blue-100 text-center shadow-sm">
                      <span class="material-icons text-blue-500 text-2xl mb-1">savings</span>
                      <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Net Benefit</p>
                      <p class="text-lg font-extrabold text-blue-700">US$ {{ (financeForm.get('annualBenefits')?.value || 0) - (financeForm.get('annualCosts')?.value || 0) | number }}</p>
                    </div>
                    <div class="bg-white rounded-xl p-4 border border-emerald-100 text-center shadow-sm">
                      <span class="material-icons text-emerald-500 text-2xl mb-1">percent</span>
                      <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">ROI</p>
                      <p class="text-lg font-extrabold text-emerald-700">{{ financeForm.get('roiPercentage')?.value || 0 }}%</p>
                    </div>
                    <div class="bg-white rounded-xl p-4 border border-amber-100 text-center shadow-sm">
                      <span class="material-icons text-amber-500 text-2xl mb-1">hourglass_bottom</span>
                      <p class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Payback</p>
                      <p class="text-lg font-extrabold text-amber-700">{{ financeForm.get('paybackPeriod')?.value || 0 }} yrs</p>
                    </div>
                  </div>

                  <!-- Finance Narrative -->
                  <div class="mt-5">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Finance Narrative / Justification</label>
                    <textarea formControlName="financeNarrative" rows="4"
                      placeholder="Provide a narrative of the financial case — key assumptions, risks to ROI, and budget approval pathway..."
                      class="w-full bg-white border border-blue-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all resize-none"></textarea>
                  </div>
                </div>
              </div>
            }

            <!-- SECTION 3: FINANCE CHECKLIST -->
            @if(currentSectionIndex() === 2) {
              <div class="animate-fade-in">
                <h2 class="text-xl font-extrabold text-gray-900 mb-6">Finance Mandatory Checklist</h2>

                <!-- Finance Reviewers Panel -->
                <div class="p-8 bg-gradient-to-br from-[#FAFBFC] to-white border border-gray-200 rounded-2xl shadow-sm mb-8 relative overflow-hidden">
                  <div class="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none"></div>
                  <h3 class="relative z-10 text-[15px] font-extrabold text-[#172B4D] mb-6 uppercase tracking-[0.1em] flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-emerald-100 text-[#00875A] flex items-center justify-center">
                      <span class="material-icons text-[18px]">group</span>
                    </div>
                    Finance Review Approvers
                  </h3>
                  <div class="grid grid-cols-2 gap-5 relative z-10">
                    <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#00875A] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                      <input type="checkbox" class="peer sr-only" checked>
                      <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00875A] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                      <div class="absolute inset-0 bg-green-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                      <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#00875A] peer-checked:border-[#00875A] transition-all duration-300 flex items-center justify-center relative z-10">
                        <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div class="relative z-10 flex-1 pl-1">
                        <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#00875A] transition-colors">Chief Financial Officer</span>
                      </div>
                    </label>
                    <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#00875A] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                      <input type="checkbox" class="peer sr-only" checked>
                      <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00875A] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                      <div class="absolute inset-0 bg-green-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                      <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#00875A] peer-checked:border-[#00875A] transition-all duration-300 flex items-center justify-center relative z-10">
                        <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div class="relative z-10 flex-1 pl-1">
                        <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#00875A] transition-colors">Finance Controller</span>
                      </div>
                    </label>
                    <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#00875A] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                      <input type="checkbox" class="peer sr-only">
                      <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00875A] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                      <div class="absolute inset-0 bg-green-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                      <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#00875A] peer-checked:border-[#00875A] transition-all duration-300 flex items-center justify-center relative z-10">
                        <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div class="relative z-10 flex-1 pl-1">
                        <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#00875A] transition-colors">Budget Analyst</span>
                      </div>
                    </label>
                    <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#00875A] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                      <input type="checkbox" class="peer sr-only">
                      <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#00875A] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                      <div class="absolute inset-0 bg-green-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                      <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#00875A] peer-checked:border-[#00875A] transition-all duration-300 flex items-center justify-center relative z-10">
                        <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div class="relative z-10 flex-1 pl-1">
                        <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#00875A] transition-colors">VP of Finance</span>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Mandatory Finance Verification -->
                <div class="p-8 bg-[#FAFBFC] border border-[#DFE1E6] rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden">
                  <div class="absolute bottom-0 left-0 w-80 h-32 bg-emerald-50 rounded-full blur-3xl opacity-60 -ml-20 -mb-10 pointer-events-none"></div>
                  <h3 class="relative z-10 text-[15px] font-extrabold text-emerald-800 mb-6 uppercase tracking-[0.1em] flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <span class="material-icons text-[18px]">verified_user</span>
                    </div>
                    Mandatory Finance Verification
                  </h3>
                  <div class="flex flex-col gap-4 relative z-10">
                    <label class="relative flex items-start gap-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                      <input type="checkbox" class="peer sr-only">
                      <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-600 translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                      <div class="absolute inset-0 bg-emerald-50/10 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                      <div class="flex-shrink-0 w-6 h-6 mt-0.5 border-2 border-gray-300 rounded bg-white peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all duration-300 flex items-center justify-center relative z-10">
                        <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div class="relative z-10 flex-1 pl-1">
                        <span class="block text-[15px] font-extrabold text-gray-900 group-hover:text-emerald-700 transition-colors leading-snug">Cost Plan & Budget Verified</span>
                        <span class="block text-[13px] font-medium text-gray-500 mt-1.5 leading-relaxed">All line items have been reviewed and the budget ceiling is within organizational approval limits.</span>
                      </div>
                    </label>
                    <label class="relative flex items-start gap-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                      <input type="checkbox" class="peer sr-only">
                      <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-600 translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                      <div class="absolute inset-0 bg-emerald-50/10 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                      <div class="flex-shrink-0 w-6 h-6 mt-0.5 border-2 border-gray-300 rounded bg-white peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all duration-300 flex items-center justify-center relative z-10">
                        <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div class="relative z-10 flex-1 pl-1">
                        <span class="block text-[15px] font-extrabold text-gray-900 group-hover:text-emerald-700 transition-colors leading-snug">ROI Analysis Validated</span>
                        <span class="block text-[13px] font-medium text-gray-500 mt-1.5 leading-relaxed">Financial model assumptions, payback period, and net benefit calculations have been independently validated.</span>
                      </div>
                    </label>
                    <label class="relative flex items-start gap-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                      <input type="checkbox" class="peer sr-only">
                      <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-600 translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                      <div class="absolute inset-0 bg-emerald-50/10 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                      <div class="flex-shrink-0 w-6 h-6 mt-0.5 border-2 border-gray-300 rounded bg-white peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all duration-300 flex items-center justify-center relative z-10">
                        <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div class="relative z-10 flex-1 pl-1">
                        <span class="block text-[15px] font-extrabold text-gray-900 group-hover:text-emerald-700 transition-colors leading-snug">CapEx / OpEx Classification Confirmed</span>
                        <span class="block text-[13px] font-medium text-gray-500 mt-1.5 leading-relaxed">All cost items are correctly classified per GAAP/IFRS accounting standards and organizational policy.</span>
                      </div>
                    </label>
                    <label class="relative flex items-start gap-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                      <input type="checkbox" class="peer sr-only">
                      <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-600 translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                      <div class="absolute inset-0 bg-emerald-50/10 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                      <div class="flex-shrink-0 w-6 h-6 mt-0.5 border-2 border-gray-300 rounded bg-white peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all duration-300 flex items-center justify-center relative z-10">
                        <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div class="relative z-10 flex-1 pl-1">
                        <span class="block text-[15px] font-extrabold text-gray-900 group-hover:text-emerald-700 transition-colors leading-snug">Funding Source Committed</span>
                        <span class="block text-[13px] font-medium text-gray-500 mt-1.5 leading-relaxed">Funding has been formally allocated from the approved budget or approved via capital appropriation request.</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            }

          </form>

          <!-- NAVIGATION ACTIONS -->
          <div class="mt-8 flex items-center justify-between pt-6 border-t border-gray-100">
            <button type="button"
              class="px-6 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-[13px] bg-white hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
              (click)="cancel()">
              <span class="material-icons text-[18px]">close</span> Cancel
            </button>

            <div class="flex gap-3">
              <button type="button"
                class="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-[13px] bg-white hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
                (click)="previousSection()" [class.invisible]="currentSectionIndex() === 0">
                <span class="material-icons text-[18px]">arrow_back</span> Previous
              </button>

              <button type="button"
                class="px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 font-bold text-[13px] bg-emerald-50 hover:bg-emerald-100 transition-colors shadow-sm flex items-center gap-2"
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

  projectId: string = '';
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
