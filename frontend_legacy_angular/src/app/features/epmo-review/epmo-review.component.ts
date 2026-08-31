import { Component, signal, inject, computed, Input, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-epmo-review',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="animate-fade-in mx-auto w-full mt-2" [class.embedded-mode]="embeddedMode">
      <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          
          <!-- Header -->
          <div class="flex items-start justify-between mb-8">
              <div>
                  <h1 class="text-[20px] font-extrabold text-[#172B4D] flex items-center gap-3">
                      <span class="material-icons text-indigo-600 bg-indigo-50 p-1.5 rounded-lg text-[20px]">assignment_turned_in</span>
                      Conduct EPMO Check-in
                  </h1>
                  <p class="text-[13px] font-medium text-gray-500 mt-2">Please complete the checklist below to evaluate project alignment and governance readiness.</p>
              </div>
              <div class="flex items-center gap-2 border border-green-200 bg-green-50 px-3 py-1.5 rounded-full text-green-700 text-[11px] font-bold tracking-wide">
                  <span class="material-icons text-[14px]">check_circle</span>
                  Auto-saved Just now
              </div>
          </div>

          <form [formGroup]="epmoForm" class="space-y-4">
              
              <!-- Card 1: Strategy -->
              <div class="flex items-center justify-between p-5 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div class="flex items-start gap-4 flex-1">
                      <div class="w-12 h-12 rounded-xl bg-indigo-50/80 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/50">
                          <span class="material-icons text-[24px]">track_changes</span>
                      </div>
                      <div>
                          <h3 class="text-[14px] font-bold text-gray-900 mb-1">Is aligned with strategy? <span class="text-red-500">*</span></h3>
                          <p class="text-[12px] text-gray-500 font-medium leading-relaxed">Does this project align with organizational strategy and business objectives?</p>
                      </div>
                  </div>
                  <div class="flex items-center gap-14 ml-6 shrink-0">
                      <div class="flex items-center gap-8">
                          <label class="flex items-center gap-3 cursor-pointer group">
                              <input type="radio" formControlName="epmo_strategy" value="Yes" class="w-5 h-5 text-indigo-600 bg-gray-50 border-gray-300 focus:ring-indigo-600 cursor-pointer">
                              <span class="text-[14px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors">Yes</span>
                          </label>
                          <label class="flex items-center gap-3 cursor-pointer group">
                              <input type="radio" formControlName="epmo_strategy" value="No" class="w-5 h-5 text-indigo-600 bg-gray-50 border-gray-300 focus:ring-indigo-600 cursor-pointer">
                              <span class="text-[14px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors">No</span>
                          </label>
                      </div>
                      <button type="button" class="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 flex items-center justify-center transition-all bg-white shadow-sm">
                          <span class="material-icons text-[18px]">chat_bubble_outline</span>
                      </button>
                  </div>
              </div>

              <!-- Card 2: PIC -->
              <div class="flex items-center justify-between p-5 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div class="flex items-start gap-4 flex-1">
                      <div class="w-12 h-12 rounded-xl bg-indigo-50/80 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/50">
                          <span class="material-icons text-[24px]">groups</span>
                      </div>
                      <div>
                          <h3 class="text-[14px] font-bold text-gray-900 mb-1">PIC Needed? <span class="text-red-500">*</span></h3>
                          <p class="text-[12px] text-gray-500 font-medium leading-relaxed">Is Project Investment Committee (PIC) approval required for this project?</p>
                      </div>
                  </div>
                  <div class="flex items-center gap-14 ml-6 shrink-0">
                      <div class="flex items-center gap-8">
                          <label class="flex items-center gap-3 cursor-pointer group">
                              <input type="radio" formControlName="epmo_pic_needed" value="Yes" class="w-5 h-5 text-indigo-600 bg-gray-50 border-gray-300 focus:ring-indigo-600 cursor-pointer">
                              <span class="text-[14px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors">Yes</span>
                          </label>
                          <label class="flex items-center gap-3 cursor-pointer group">
                              <input type="radio" formControlName="epmo_pic_needed" value="No" class="w-5 h-5 text-indigo-600 bg-gray-50 border-gray-300 focus:ring-indigo-600 cursor-pointer">
                              <span class="text-[14px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors">No</span>
                          </label>
                      </div>
                      <button type="button" class="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 flex items-center justify-center transition-all bg-white shadow-sm">
                          <span class="material-icons text-[18px]">chat_bubble_outline</span>
                      </button>
                  </div>
              </div>

              <!-- Card 3: PM -->
              <div class="flex items-center justify-between p-5 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div class="flex items-start gap-4 flex-1">
                      <div class="w-12 h-12 rounded-xl bg-indigo-50/80 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/50">
                          <span class="material-icons text-[24px]">person_outline</span>
                      </div>
                      <div>
                          <h3 class="text-[14px] font-bold text-gray-900 mb-1">Is Project Manager Required?</h3>
                          <p class="text-[12px] text-gray-500 font-medium leading-relaxed">Do we need to assign a dedicated project manager for this initiative?</p>
                      </div>
                  </div>
                  <div class="flex items-center gap-14 ml-6 shrink-0">
                      <div class="flex items-center gap-8">
                          <label class="flex items-center gap-3 cursor-pointer group">
                              <input type="radio" formControlName="epmo_pm_required" value="Yes" class="w-5 h-5 text-indigo-600 bg-gray-50 border-gray-300 focus:ring-indigo-600 cursor-pointer">
                              <span class="text-[14px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors">Yes</span>
                          </label>
                          <label class="flex items-center gap-3 cursor-pointer group">
                              <input type="radio" formControlName="epmo_pm_required" value="No" class="w-5 h-5 text-indigo-600 bg-gray-50 border-gray-300 focus:ring-indigo-600 cursor-pointer">
                              <span class="text-[14px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors">No</span>
                          </label>
                      </div>
                      <button type="button" class="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 flex items-center justify-center transition-all bg-white shadow-sm">
                          <span class="material-icons text-[18px]">chat_bubble_outline</span>
                      </button>
                  </div>
              </div>

              <!-- Card 4: Related Project -->
              <div class="flex items-center justify-between p-5 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div class="flex items-start gap-4 flex-1">
                      <div class="w-12 h-12 rounded-xl bg-indigo-50/80 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/50">
                          <span class="material-icons text-[24px]">link</span>
                      </div>
                      <div>
                          <h3 class="text-[14px] font-bold text-gray-900 mb-1">Related to Existing Project?</h3>
                          <p class="text-[12px] text-gray-500 font-medium leading-relaxed">Is this project related to or dependent on any existing projects or initiatives?</p>
                      </div>
                  </div>
                  <div class="flex items-center gap-14 ml-6 shrink-0">
                      <div class="flex items-center gap-8">
                          <label class="flex items-center gap-3 cursor-pointer group">
                              <input type="radio" formControlName="epmo_related_project" value="Yes" class="w-5 h-5 text-indigo-600 bg-gray-50 border-gray-300 focus:ring-indigo-600 cursor-pointer">
                              <span class="text-[14px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors">Yes</span>
                          </label>
                          <label class="flex items-center gap-3 cursor-pointer group">
                              <input type="radio" formControlName="epmo_related_project" value="No" class="w-5 h-5 text-indigo-600 bg-gray-50 border-gray-300 focus:ring-indigo-600 cursor-pointer">
                              <span class="text-[14px] font-bold text-gray-700 group-hover:text-indigo-700 transition-colors">No</span>
                          </label>
                      </div>
                      <button type="button" class="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 flex items-center justify-center transition-all bg-white shadow-sm">
                          <span class="material-icons text-[18px]">chat_bubble_outline</span>
                      </button>
                  </div>
              </div>

              <!-- EPMO Governance Checklist Panel -->
              <div class="mt-8 p-6 bg-gradient-to-br from-[#F8FAFC] to-[#EEF2FF]/40 border border-indigo-100 rounded-2xl shadow-sm relative overflow-hidden">
                <div class="absolute top-0 right-0 w-64 h-64 bg-indigo-100/50 rounded-full blur-3xl opacity-40 -mr-10 -mt-10 pointer-events-none"></div>
                
                <h3 class="relative z-10 text-[14px] font-extrabold text-[#1E293B] mb-5 uppercase tracking-wider flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                        <span class="material-icons text-[18px]">fact_check</span> 
                    </div>
                    EPMO Mandatory Evaluation Checklist
                </h3>
                
                <div class="grid grid-cols-2 gap-4 relative z-10">
                    <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200/80 rounded-xl shadow-sm hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all duration-200 overflow-hidden group">
                        <input type="checkbox" formControlName="epmo_checklist_strategic_fit" class="peer sr-only">
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600 translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-200 z-0"></div>
                        <div class="flex-shrink-0 w-5 h-5 border-2 border-gray-300 rounded bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all duration-200 flex items-center justify-center relative z-10">
                            <svg class="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div class="relative z-10 flex-1 pl-1">
                            <span class="block text-[13px] font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">Strategic Priority Alignment Verified</span>
                        </div>
                    </label>

                    <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200/80 rounded-xl shadow-sm hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all duration-200 overflow-hidden group">
                        <input type="checkbox" formControlName="epmo_checklist_roi_validated" class="peer sr-only">
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600 translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-200 z-0"></div>
                        <div class="flex-shrink-0 w-5 h-5 border-2 border-gray-300 rounded bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all duration-200 flex items-center justify-center relative z-10">
                            <svg class="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div class="relative z-10 flex-1 pl-1">
                            <span class="block text-[13px] font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">Business Case &amp; ROI Validated</span>
                        </div>
                    </label>

                    <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200/80 rounded-xl shadow-sm hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all duration-200 overflow-hidden group">
                        <input type="checkbox" formControlName="epmo_checklist_pm_assigned" class="peer sr-only">
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600 translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-200 z-0"></div>
                        <div class="flex-shrink-0 w-5 h-5 border-2 border-gray-300 rounded bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all duration-200 flex items-center justify-center relative z-10">
                            <svg class="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div class="relative z-10 flex-1 pl-1">
                            <span class="block text-[13px] font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">Dedicated Project Manager Assigned</span>
                        </div>
                    </label>

                    <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200/80 rounded-xl shadow-sm hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all duration-200 overflow-hidden group">
                        <input type="checkbox" formControlName="epmo_checklist_capacity_confirmed" class="peer sr-only">
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600 translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-200 z-0"></div>
                        <div class="flex-shrink-0 w-5 h-5 border-2 border-gray-300 rounded bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all duration-200 flex items-center justify-center relative z-10">
                            <svg class="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div class="relative z-10 flex-1 pl-1">
                            <span class="block text-[13px] font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">Resource Allocation &amp; Capacity Confirmed</span>
                        </div>
                    </label>

                    <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200/80 rounded-xl shadow-sm hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all duration-200 overflow-hidden group">
                        <input type="checkbox" formControlName="epmo_checklist_risk_plan_defined" class="peer sr-only">
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600 translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-200 z-0"></div>
                        <div class="flex-shrink-0 w-5 h-5 border-2 border-gray-300 rounded bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all duration-200 flex items-center justify-center relative z-10">
                            <svg class="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div class="relative z-10 flex-1 pl-1">
                            <span class="block text-[13px] font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">Risk Management Plan Mapped</span>
                        </div>
                    </label>

                    <label class="relative flex items-center gap-4 p-4 bg-white border border-gray-200/80 rounded-xl shadow-sm hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all duration-200 overflow-hidden group">
                        <input type="checkbox" formControlName="epmo_checklist_gate_approval" class="peer sr-only">
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600 translate-x-[-100%] peer-checked:translate-x-0 transition-transform duration-200 z-0"></div>
                        <div class="flex-shrink-0 w-5 h-5 border-2 border-gray-300 rounded bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all duration-200 flex items-center justify-center relative z-10">
                            <svg class="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div class="relative z-10 flex-1 pl-1">
                            <span class="block text-[13px] font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">EPMO Governance Gate Approved</span>
                        </div>
                    </label>
                </div>
              </div>

              <!-- Text Area -->
              <div class="mt-8 border border-gray-200 rounded-xl p-5 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <h3 class="text-[13px] font-bold text-gray-900 mb-1">Additional Comments (Optional)</h3>
                  <p class="text-[12px] text-gray-500 font-medium mb-3">Provide any additional context or observations...</p>
                  <textarea formControlName="epmo_comments" rows="3" class="w-full resize-none border-none outline-none text-[13px] text-gray-700 placeholder-gray-400 leading-relaxed font-medium" placeholder="Start typing here..."></textarea>
                  <div class="flex justify-end mt-2">
                      <span class="text-[11px] text-gray-400 font-bold tracking-wide">0 / 1000</span>
                  </div>
              </div>

              <!-- Footer Buttons -->
              <div class="flex justify-between items-center mt-10 pt-4">
                  <!-- Back Button -->
                  <button type="button" class="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-700 font-bold text-[13px] hover:bg-gray-50 flex items-center gap-2 transition-colors shadow-sm bg-white">
                      <span class="material-icons text-[16px]">arrow_back</span>
                      Back
                  </button>

                  <!-- Save & Continue Button matching the reference purple -->
                  <button type="button" 
                          class="px-6 py-2.5 rounded-lg bg-[#533BED] hover:bg-[#432BC2] text-white font-bold text-[13px] flex items-center gap-2 transition-colors shadow-sm" 
                          [disabled]="!epmoForm.valid || isSubmitting()" 
                          (click)="submitDecision('Approve')">
                      {{ isSubmitting() ? 'Saving...' : 'Save & Continue' }}
                      <span class="material-icons text-[16px]" *ngIf="!isSubmitting()">arrow_forward</span>
                      <span class="material-icons text-[16px] animate-spin" *ngIf="isSubmitting()">refresh</span>
                  </button>
              </div>

          </form>
      </div>
    </div>
  `,
})
export class EpmoReviewComponent implements OnInit, OnChanges {
  private fb = inject(FormBuilder);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  @Input() embeddedMode = false;
  @Input() forceReviewScreen = false;
  
  projectId = signal<string | null>(null);
  isSubmitting = signal(false);

  epmoForm: FormGroup = this.fb.group({
    epmo_strategy: ['', Validators.required],
    epmo_pic_needed: ['', Validators.required],
    epmo_pm_required: [''],
    epmo_related_project: [''],
    epmo_checklist_strategic_fit: [true],
    epmo_checklist_roi_validated: [true],
    epmo_checklist_pm_assigned: [true],
    epmo_checklist_capacity_confirmed: [true],
    epmo_checklist_risk_plan_defined: [true],
    epmo_checklist_gate_approval: [true],
    epmo_comments: ['']
  });

  ngOnInit() {
    this.extractProjectId();
  }

  ngOnChanges(changes: SimpleChanges) {
    // If embedded or forced, ensure UI re-renders cleanly
  }

  private extractProjectId() {
    const url = window.location.href;
    const match = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (match) {
        this.projectId.set(match[0]);
    }
  }

  submitDecision(decision: string) {
    if (!this.projectId()) {
      alert("No active Project ID found. Please go back to dashboard and select a project.");
      return;
    }
    
    if (decision === 'Approve' && this.epmoForm.invalid) {
      alert("Please fill in all mandatory fields before approving.");
      this.epmoForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const updates = { 
        ...this.epmoForm.value
    };

    this.projectService.submitDecision(
      this.projectId()!, 
      'EPMO Review', 
      decision, 
      this.epmoForm.value.epmo_comments || 'EPMO Review Completed via Dashboard.', 
      updates
    ).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        if(!this.embeddedMode) {
          this.router.navigate(['/team-inbox']).then(() => {
              alert('EPMO Review Successfully Submitted! Project routed to BTA.');
          });
        } else {
          // If embedded context, reload navigation to jump to BTA queue automatically
          this.router.navigate(['/projects']).then(() => {
              this.router.navigate(['/team-inbox']);
          });
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error(err);
        alert('Failed to submit EPMO decision.');
      }
    });
  }
}
