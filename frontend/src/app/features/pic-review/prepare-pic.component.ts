import { Component, signal, inject, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';

@Component({
  selector: 'app-prepare-pic',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-in" [ngClass]="embeddedMode ? '' : 'stepper-layout'">
      
      <!-- HEADER -->
      @if(!embeddedMode) {
      <div class="stepper-header">
        <button class="back-btn" (click)="goBack()">
          <span class="material-icons">arrow_back</span>
        </button>
        <div class="header-titles">
          <h2>Prepare for PIC</h2>
          <p class="subtitle">Assign to: <span class="assigned-user">PIC Team</span></p>
        </div>
      </div>
      }

      <div class="layout-body" [class.border-t]="!embeddedMode" [class.border-gray-100]="!embeddedMode" [class.pt-6]="!embeddedMode" [style]="embeddedMode ? 'display: block;' : ''">
        <!-- LEFT CONTENT -->
        <div class="content-panel" [ngClass]="embeddedMode ? '' : 'card'">
          <div class="card-body" style="padding:0">
            <!-- EMBEDDED MODE HORIZONTAL TABS -->
            @if(forceReviewScreen) {
              <div class="embedded-mode-tabs flex gap-2 overflow-x-auto pb-4 border-b border-gray-100 p-6 pt-4 mb-2">
                <button type="button" *ngFor="let s of sections; let i = index" 
                        (click)="setSection(i)"
                        class="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border"
                        [ngClass]="currentSectionIndex() === i ? 
                          'bg-[#0052CC] text-white border-[#0052CC]' : 
                          'bg-white text-[#6B778C] border-gray-200 hover:border-[#0052CC] hover:text-[#0052CC]'">
                  {{ s.title }}
                </button>
              </div>
            }
            
            <!-- STEP 1: Core Project Definition & Justification -->
            @if (currentSectionIndex() === 0) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Project Identification</h3>
                </div>
                <div class="p-6">
                  <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                      <label>Project Name</label>
                      <input type="text" class="form-control" [value]="projectData.name" readonly>
                    </div>
                    <div class="form-group">
                      <label>Department / Clinical Specialty</label>
                      <input type="text" class="form-control" [value]="projectData.dept" readonly>
                    </div>
                    <div class="form-group">
                      <label>Project ID</label>
                      <input type="text" class="form-control" [value]="projectData.number" readonly>
                    </div>
                    <div class="form-group">
                      <label>Submission Date</label>
                      <input type="text" class="form-control" [value]="projectData.due" readonly>
                    </div>
                  </div>

                  <div class="form-group mt-4">
                    <label>Problem or Opportunity Statement</label>
                    <textarea class="form-control" rows="4">{{ projectData.problemStatement || 'Not provided' }}</textarea>
                  </div>
                  
                  <div class="form-group mt-4">
                    <label>Scope of Project (High Level)</label>
                    <textarea class="form-control" rows="3">{{ projectData.scope || 'Not provided' }}</textarea>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 2: Vendor Recommendation & Selection -->
            @if (currentSectionIndex() === 1) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Evaluation Criteria & Vendor Comparison</h3>
                </div>
                <div class="p-6">
                  <div class="form-group">
                    <label>Primary Recommended Vendor</label>
                    <input type="text" class="form-control" placeholder="Enter vendor name">
                  </div>
                  <div class="form-group mt-4">
                    <label>Justification for Recommended Vendor</label>
                    <textarea class="form-control" rows="4" placeholder="Why was this vendor selected over others?"></textarea>
                  </div>
                  <div class="form-group mt-4">
                    <label>Specific Benefits of Recommended Vendor</label>
                    <textarea class="form-control" rows="3" placeholder="Additional cost or strategic benefits"></textarea>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 3: Project Evaluation & Benefit -->
            @if (currentSectionIndex() === 2) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Quantifiable Benefits / Savings</h3>
                </div>
                <div class="p-6">
                  <div class="form-group">
                    <label>Primary Benefit Category</label>
                    <select class="form-control">
                      <option>Cost Reduction</option>
                      <option>Revenue Generation</option>
                      <option>Compliance Risk Avoidance</option>
                      <option>Clinical Efficiency</option>
                    </select>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-4 mt-4">
                    <div class="form-group">
                      <label>Annual Quantified Value (Year 1)</label>
                      <input type="text" class="form-control" placeholder="$0.00">
                    </div>
                    <div class="form-group">
                      <label>Annual Quantified Value (Year 2)</label>
                      <input type="text" class="form-control" placeholder="$0.00">
                    </div>
                  </div>
                  <div class="form-group mt-4">
                    <label>Benefit Calculation Methodology</label>
                    <textarea class="form-control" rows="3" placeholder="How were these benefits calculated?"></textarea>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 4: Cost Plan & ROI Analysis -->
            @if (currentSectionIndex() === 3) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Detailed Cost Plan & ROI</h3>
                </div>
                <div class="p-6">
                  <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                      <label>Total Capex (Capital Expenditure)</label>
                      <input type="text" class="form-control" placeholder="$0.00">
                    </div>
                    <div class="form-group">
                      <label>Total Opex (Operating Expenses)</label>
                      <input type="text" class="form-control" [value]="projectData.budget || '$0.00'">
                    </div>
                    <div class="form-group">
                      <label>Net Present Value (NPV)</label>
                      <input type="text" class="form-control" placeholder="$0.00">
                    </div>
                    <div class="form-group">
                      <label>Internal Rate of Return (IRR)</label>
                      <input type="text" class="form-control" placeholder="0%">
                    </div>
                    <div class="form-group">
                      <label>Payback Period (Months)</label>
                      <input type="text" class="form-control" placeholder="0">
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 5: Project Execution & Ask -->
            @if (currentSectionIndex() === 4) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Project Execution Readiness</h3>
                </div>
                <div class="p-6">
                  <div class="form-group">
                    <label>Milestone Target Dates</label>
                    <textarea class="form-control" rows="4" placeholder="List key milestones and planned dates"></textarea>
                  </div>
                  <div class="form-group mt-4">
                    <label>Resource Ask (FTE Requirements)</label>
                    <textarea class="form-control" rows="3" placeholder="What internal resources are required from IT, Clinical, or Operations?"></textarea>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 6: Supporting Information & Resources -->
            @if (currentSectionIndex() === 5) {
              <div class="section-content animate-slide-in">
                <div class="section-header">
                  <h3>Supporting Resources & Final Submission</h3>
                </div>
                <div class="p-6">
                  <div class="form-group">
                    <label>Attachments & References</label>
                    <div style="border: 2px dashed #DFE3ED; padding: 30px; text-align:center; border-radius: 8px; cursor: pointer; color: #42526E">
                      <span class="material-icons" style="font-size: 32px">upload_file</span>
                      <p>Drag and drop supporting artifacts here</p>
                    </div>
                  </div>
                  <div class="form-group mt-6">
                     <label>Preparation Comments</label>
                     <textarea class="form-control" rows="4" [(ngModel)]="comments" placeholder="Add any notes for the PIC committee..."></textarea>
                  </div>
                </div>
              </div>
            }

            <!-- STEP 7: PIC Approval Checklist -->
            @if (currentSectionIndex() === 6) {
              <div class="section-content animate-slide-in">
                  <div class="section-header">
                    <h3>PIC Final Gate Review</h3>
                  </div>
                  <div class="p-6">
                  <div class="p-8 bg-gradient-to-br from-[#FAFBFC] to-white border border-gray-200 rounded-2xl shadow-sm mb-8 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-64 h-64 bg-red-50 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 pointer-events-none"></div>
                    <h3 class="relative z-10 text-[15px] font-extrabold text-[#172B4D] mb-6 uppercase tracking-[0.1em] flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-red-100 text-[#DE350B] flex items-center justify-center">
                            <span class="material-icons text-[18px]">group</span>
                        </div>
                        PIC Committee Gate Reviewers
                    </h3>
                    <div class="grid grid-cols-2 gap-5 relative z-10">
                        <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#DE350B] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only" checked>
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#DE350B] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-red-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#DE350B] peer-checked:border-[#DE350B] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#DE350B] transition-colors">Chief Financial Officer</span>
                            </div>
                        </label>
                        <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#DE350B] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only" checked>
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#DE350B] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-red-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#DE350B] peer-checked:border-[#DE350B] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#DE350B] transition-colors">Project Executive Sponsor</span>
                            </div>
                        </label>
                        <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#DE350B] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only">
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#DE350B] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-red-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#DE350B] peer-checked:border-[#DE350B] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#DE350B] transition-colors">Portfolio Management Director</span>
                            </div>
                        </label>
                        <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#DE350B] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only">
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#DE350B] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-red-50/20 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#DE350B] peer-checked:border-[#DE350B] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[14px] font-bold text-gray-800 group-hover:text-[#DE350B] transition-colors">Procurement & Sourcing Lead</span>
                            </div>
                        </label>
                    </div>
                  </div>

                  <div class="p-8 bg-[#FAFBFC] border border-[#DFE1E6] rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden">
                    <div class="absolute bottom-0 left-0 w-80 h-32 bg-red-50 rounded-full blur-3xl opacity-60 -ml-20 -mb-10 pointer-events-none"></div>
                    <h3 class="relative z-10 text-[15px] font-extrabold text-[#DE350B] mb-6 uppercase tracking-[0.1em] flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-red-100 text-[#DE350B] flex items-center justify-center">
                            <span class="material-icons text-[18px]">verified_user</span>
                        </div>
                        Mandatory Executive Verification
                    </h3>
                    <div class="flex flex-col gap-4 relative z-10">
                        <label class="relative flex items-start gap-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#DE350B] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only">
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#DE350B] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-red-50/10 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 mt-0.5 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#DE350B] peer-checked:border-[#DE350B] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[15px] font-extrabold text-gray-900 group-hover:text-[#DE350B] transition-colors leading-snug">Capital Budgets Vetted & Authenticated</span>
                                <span class="block text-[13px] font-medium text-gray-500 mt-1.5 leading-relaxed">CAPEX and OPEX totals have been validated strictly against annual forecasts.</span>
                            </div>
                        </label>
                        <label class="relative flex items-start gap-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#DE350B] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only">
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#DE350B] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-red-50/10 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 mt-0.5 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#DE350B] peer-checked:border-[#DE350B] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[15px] font-extrabold text-gray-900 group-hover:text-[#DE350B] transition-colors leading-snug">Vendor Financial Contracts Finalized</span>
                                <span class="block text-[13px] font-medium text-gray-500 mt-1.5 leading-relaxed">Sourcing has reviewed vendor SaaS models and confirmed contractual savings.</span>
                            </div>
                        </label>
                        <label class="relative flex items-start gap-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#DE350B] hover:shadow-md cursor-pointer transition-all duration-300 overflow-hidden group">
                            <input type="checkbox" class="peer sr-only">
                            <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#DE350B] translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-300 ease-out z-0"></div>
                            <div class="absolute inset-0 bg-red-50/10 opacity-0 peer-checked:opacity-100 transition-opacity duration-300 z-0"></div>
                            <div class="flex-shrink-0 w-6 h-6 mt-0.5 border-2 border-gray-300 rounded bg-white peer-checked:bg-[#DE350B] peer-checked:border-[#DE350B] transition-all duration-300 flex items-center justify-center relative z-10">
                                <svg class="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-300 scale-50 peer-checked:scale-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div class="relative z-10 flex-1 pl-1">
                                <span class="block text-[15px] font-extrabold text-gray-900 group-hover:text-[#DE350B] transition-colors leading-snug">Sponsor Commitment Verified</span>
                                <span class="block text-[13px] font-medium text-gray-500 mt-1.5 leading-relaxed">Executive Sponsor has personally signed off on the execution timelines and deliverables.</span>
                            </div>
                        </label>
                    </div>
                  </div>
                  </div>
              </div>
            }

            <!-- FOOTER NAVIGATION -->
            @if(!forceReviewScreen) {
            <div class="section-footer flex justify-between items-center p-4">
              <button class="btn btn-secondary" (click)="cancel()">Cancel</button>
              
              <div class="flex gap-3">
                <button class="btn btn-secondary" (click)="previousSection()" [disabled]="currentSectionIndex() === 0">Previous</button>
                @if (currentSectionIndex() < sections.length - 1) {
                  <button class="btn btn-primary" (click)="nextSection()">Next</button>
                } @else {
                  <button class="btn btn-primary" style="background:#00875A" (click)="submitData()">Verify & Send to PIC Meeting</button>
                }
              </div>
            </div>
            }
            
          </div>
        </div>

        <!-- RIGHT SIDEBAR (Vertical Stepper) -->
        @if(!forceReviewScreen) {
        <div class="sidebar-panel">
          <div class="card p-4">
            <h3 class="sidebar-title">Step-by-Step Preparation</h3>
            <ul class="vertical-stepper">
              @for (step of sections; track step.title; let i = $index) {
                <li 
                  class="step-item" 
                  [class.active]="currentSectionIndex() === i"
                  [class.completed]="currentSectionIndex() > i"
                  (click)="setSection(i)">
                  <div class="step-indicator">
                    @if (currentSectionIndex() > i) {
                      <span class="material-icons" style="font-size: 14px;">check</span>
                    } @else {
                      <span class="dot"></span>
                    }
                  </div>
                  <span class="step-title">{{ step.title }}</span>
                </li>
              }
            </ul>
          </div>
        </div>
        }

      </div>
    </div>
  `,
  styles: [`

    /* Premium PIC Layout */
    .stepper-layout { 
      display: flex; flex-direction: column; gap: 20px; 
      padding: 28px; max-width: 1400px; margin: 0 auto;
      background-color: #F8FAFC; min-height: 100vh;
      font-family: 'Inter', sans-serif;
    }
    
    .stepper-header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
    .back-btn { 
      width: 44px; height: 44px; border-radius: 50%; 
      border: 1px solid rgba(226,232,240,0.8); background: white; 
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(79,70,229,0.05); transition: all 0.2s;
    }
    .back-btn:hover { background: rgba(238,242,255,0.7); color: #4F46E5; border-color: #4F46E5; }
    .header-titles h2 { margin: 0; font-size: 24px; font-weight: 800; color: #1E293B; font-family: 'Outfit', sans-serif; }
    .subtitle { margin: 4px 0 0; font-size: 13px; font-weight: 500; color: #64748B; }
    .assigned-user { color: #4F46E5; font-weight: 700; }

    .layout-body { display: grid; grid-template-columns: 1fr 340px; gap: 28px; align-items: start; }
    
    .content-panel { 
      min-height: 500px; display: flex; flex-direction: column; 
    }
    .card {
      background: white; border: 1px solid rgba(226,232,240,0.8);
      border-radius: 18px; box-shadow: 0 4px 24px rgba(79,70,229,0.05);
      overflow: hidden; position: relative;
    }
    .card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, #10B981 0%, #059669 50%, #34D399 100%);
    }
    
    .section-header { 
      padding: 20px 28px; border-bottom: 1px solid rgba(226,232,240,0.6); 
      background: rgba(248,250,252,0.5); border-radius: 12px 12px 0 0; 
    }
    .section-header h3 { margin: 0; font-size: 18px; font-weight: 800; color: #1E293B; font-family: 'Outfit', sans-serif; }
    
    .section-footer { 
      border-top: 1px solid rgba(226,232,240,0.6); background: white; 
      border-radius: 0 0 12px 12px; padding: 20px 28px;
    }

    .sidebar-panel { position: sticky; top: 24px; }
    .sidebar-title { 
      font-size: 13px; font-weight: 800; color: #64748B; margin: 0 0 16px 0; 
      padding-bottom: 12px; border-bottom: 1px solid rgba(226,232,240,0.6);
      text-transform: uppercase; letter-spacing: 0.5px;
    }

    .vertical-stepper { list-style: none; padding: 0; margin: 0; position: relative; }
    .vertical-stepper::before { 
      content: ''; position: absolute; top: 12px; bottom: 30px; left: 11px; width: 2px; 
      background: linear-gradient(180deg, #10B981 0%, rgba(226,232,240,0.4) 100%); z-index: 1; 
    }
    
    .step-item { 
      display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; 
      cursor: pointer; position: relative; z-index: 2; opacity: 0.6; transition: all 0.2s; 
      padding: 8px 10px; border-radius: 10px;
    }
    .step-item:hover { opacity: 1; background: rgba(240,253,244,0.5); }
    .step-item.active { opacity: 1; background: rgba(240,253,244,0.8); }
    .step-item.completed { opacity: 1; }
    
    .step-indicator { 
      width: 24px; height: 24px; border-radius: 50%; background: white; 
      border: 2px solid #E2E8F0; display: flex; align-items: center; justify-content: center; transition: all 0.3s; 
      box-shadow: 0 0 0 0 transparent;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: transparent; }
    
    .step-item.active .step-indicator { border-color: #10B981; box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
    .step-item.active .dot { background: linear-gradient(135deg, #10B981, #059669); }
    .step-item.active .step-title { color: #10B981; font-weight: 800; }
    
    .step-item.completed .step-indicator { background: #D1FAE5; border-color: #059669; color: #059669; }
    .step-item.completed .step-indicator .material-icons { font-size: 14px; font-weight: bold; }
    .step-title { font-size: 14px; font-weight: 600; color: #64748B; margin-top: 2px; }

    /* Form Controls */
    .form-group label { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px; }
    
    .form-control {
      width: 100%; padding: 10px 14px; font-size: 13px; font-family: 'Inter', sans-serif; font-weight: 500;
      border: 1.5px solid #E2E8F0; border-radius: 10px; background: white; color: #1E293B; outline: none; transition: all 0.2s;
    }
    .form-control:focus { border-color: rgba(16,185,129,0.5); box-shadow: 0 0 0 4px rgba(16,185,129,0.10); }
    .form-control[readonly] { background-color: #F8FAFC; }

    .btn { padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s; font-family: 'Inter', sans-serif; }
    .btn-primary { background: linear-gradient(135deg, #10B981, #059669); color: white; border: none; box-shadow: 0 4px 14px rgba(16,185,129,0.3); }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(16,185,129,0.4); }
    .btn-primary:disabled { background: #E2E8F0; color: #94A3B8; cursor: not-allowed; box-shadow: none; transform: none; }
    
    .btn-secondary { background: white; color: #64748B; border: 1.5px solid rgba(226,232,240,0.9); }
    .btn-secondary:hover:not(:disabled) { background: rgba(248,250,252,0.9); border-color: rgba(16,185,129,0.3); color: #10B981; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  `]
})
export class PreparePicComponent implements OnInit {
  router = inject(Router);
  projectService = inject(ProjectService);
  
  @Input() embeddedMode = false;
  @Input() forceReviewScreen = false;
  
  projectId: string = '';
  projectData: any = {};
  comments: string = '';
  
  currentSectionIndex = signal<number>(0);
  sections = [
    { title: 'Core Project Definition & Justification' },
    { title: 'Vendor Recommendation & Selection' },
    { title: 'Project Evaluation & Benefit' },
    { title: 'Cost Plan & ROI Analysis' },
    { title: 'Project Execution & Ask' },
    { title: 'Supporting Information & Resources' },
    { title: 'PIC Approval Checklist' }
  ];

  ngOnInit() {
    if (this.embeddedMode) {
      return; // Handled by ReviewWorkspaceComponent parent data
    }
    const state = history.state;
    if (state && state.projectId) {
      this.projectId = state.projectId;
      this.projectData = state.projectData || {};
    } else {
      // For standalone testing without navigating from inbox
      this.cancel();
    }
  }

  setSection(index: number) { this.currentSectionIndex.set(index); }
  nextSection() { if (this.currentSectionIndex() < this.sections.length - 1) this.currentSectionIndex.update(i => i + 1); }
  previousSection() { if (this.currentSectionIndex() > 0) this.currentSectionIndex.update(i => i - 1); }

  submitData() {
    this.projectService.submitDecision(this.projectId, 'Prepare for PIC', 'Approve', this.comments, {})
      .subscribe({
        next: () => {
          alert("Preparation submitted successfully! Project routed to PIC Meeting.");
          this.router.navigate(['/team-inbox']);
        },
        error: (err) => alert("Error submitting request.")
      });
  }
  
  cancel() {
    this.router.navigate(['/team-inbox']);
  }
  
  goBack() {
    this.cancel();
  }
}
