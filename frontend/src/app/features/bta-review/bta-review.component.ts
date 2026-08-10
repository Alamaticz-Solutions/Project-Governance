import { Component, signal, inject, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { BtaRequestService } from '../../core/services/bta-request.service';
import { GatewayChecklistComponent } from '../../shared/components/gateway-checklist/gateway-checklist.component';

/* ─── shared Tailwind-like classes used throughout ─────────────────── */
const INPUT_CLS = `w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200`;
const INPUT_STYLE = `background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.1); color: #F1F5F9; backdrop-filter: blur(8px);`;
const INPUT_FOCUS = `onfocus="this.style.borderColor='rgba(99,102,241,0.5)'; this.style.boxShadow='0 0 0 4px rgba(99,102,241,0.15)'; this.style.background='rgba(30,41,59,0.9)';" onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.boxShadow='none'; this.style.background='rgba(30,41,59,0.7)';"`;
const SELECT_SVG = `data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E`;

@Component({
  selector: 'app-bta-review',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, GatewayChecklistComponent],
  template: `
    <div class="animate-fade-in w-full font-sans" [class.p-0]="embeddedMode">

      <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start" [class.block]="forceReviewScreen">
        
        <!-- ══ VERTICAL STEPPER SIDEBAR ══ -->
        @if(!forceReviewScreen) {
          <div class="premium-card p-5 sticky top-6 hidden lg:block">
            <h3 class="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-5 px-2 relative z-10">BTA Review Steps</h3>
            <div class="flex flex-col relative space-y-1 z-10">
               <!-- Connecting Line -->
               <div class="absolute left-[23px] top-4 bottom-6 w-[2px] bg-white/10 z-0"></div>

               @for(step of sections; track step.title; let i = $index) {
                 <div class="flex items-center gap-4 relative z-10 p-2 cursor-pointer rounded-lg hover:bg-white/5 transition-colors" (click)="setSection(i)">
                   <!-- Step Circle -->
                   <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all border-2"
                        [ngClass]="currentSectionIndex() === i ? 'bg-indigo-500 text-white border-indigo-500 shadow-md scale-110' : (currentSectionIndex() > i ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40' : 'bg-white/5 text-slate-500 border-white/10')">
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
        <div class="premium-card p-8 min-h-[600px] transition-shadow hover:shadow-[0_8px_32px_rgba(99,102,241,0.15)]"
             [ngClass]="{'lg:col-span-1': !forceReviewScreen, 'col-span-1': forceReviewScreen}">

          <!-- Subtle background glow -->
          <div class="absolute top-0 right-0 w-80 h-48 pointer-events-none opacity-40" style="background: radial-gradient(ellipse at 100% 0%, rgba(99,102,241,0.25) 0%, transparent 70%);"></div>

          <!-- Section Title & Icon -->
          <div class="flex items-start gap-4 mb-8 pb-6 border-b border-white/10 relative z-10">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-500 shadow-sm text-white">
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

        <form [formGroup]="btaForm" class="relative z-10">

          <!-- ── 1. PROJECT IDENTIFICATION ── -->
          @if(currentSectionIndex() === 0) {

            <!-- AI Auto-Population Card -->
            <div class="mb-8 rounded-xl overflow-hidden relative cursor-pointer group transition-all duration-300"
                 (click)="onExtractClicked()"
                 [style]="isExtracting
                   ? 'background: linear-gradient(135deg, #1E1B4B, #2D1B69); border: 1px solid rgba(129,140,248,0.3); box-shadow: 0 8px 32px rgba(79,70,229,0.3);'
                   : 'background: linear-gradient(135deg, rgba(30,41,59,0.6), rgba(49,46,90,0.4)); border: 1px dashed rgba(129,140,248,0.35);'"
                 onmouseenter="if(!this.style.background.includes('1E1B4B')) { this.style.background='linear-gradient(135deg, rgba(67,56,202,0.25), rgba(30,41,59,0.6))'; this.style.borderStyle='solid'; this.style.borderColor='rgba(129,140,248,0.5)'; }"
                 onmouseleave="if(!this.style.background.includes('1E1B4B')) { this.style.background='linear-gradient(135deg, rgba(30,41,59,0.6), rgba(49,46,90,0.4))'; this.style.borderStyle='dashed'; this.style.borderColor='rgba(129,140,248,0.35)'; }">

              <!-- Ambient glow when extracting -->
              @if(isExtracting) {
                <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none" style="background: radial-gradient(circle, rgba(167,139,250,0.3) 0%, transparent 70%);"></div>
              }

              <div class="flex flex-col items-center justify-center text-center py-8 px-6 relative z-10">
                @if(isExtracting) {
                  <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style="background: rgba(129,140,248,0.2); border: 1px solid rgba(129,140,248,0.3);">
                    <span class="material-icons text-3xl animate-spin" style="color: #A78BFA;">autorenew</span>
                  </div>
                  <h3 class="font-bold text-sm mb-2 text-white">Analyzing Documents...</h3>
                  <p class="text-xs" style="color: rgba(167,139,250,0.8);">Using AI to extract constraints from {{ availableDocuments }} uploaded document(s).</p>
                  <!-- Progress animation -->
                  <div class="mt-4 w-48 h-1.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.1);">
                    <div class="h-full rounded-full animate-shimmer" style="background: linear-gradient(90deg, transparent, rgba(167,139,250,0.8), transparent); background-size: 200% 100%;"></div>
                  </div>
                } @else {
                  <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300" style="background: rgba(99,102,241,0.15); border: 1px solid rgba(129,140,248,0.3);">
                    <span class="material-icons text-3xl" style="color: #818CF8;">document_scanner</span>
                  </div>
                  <h3 class="font-bold text-sm mb-2" style="color: #F1F5F9;">AI Form Auto-Population</h3>
                  <p class="text-xs" style="color: #94A3B8;">Click to automatically extract constraints from <span class="font-bold" style="color: #A5B4FC;">{{ availableDocuments }}</span> uploaded document(s) in the workspace and fill this form.</p>
                }
              </div>
            </div>

            <!-- Form fields grid -->
            <div class="grid grid-cols-2 gap-x-6 gap-y-5 animate-fade-in">

              <!-- Project Name -->
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Project Name <span style="color: #DC2626;">*</span></label>
                <div class="relative">
                  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none" style="color: #94A3B8;">description</span>
                  <input type="text" formControlName="projectName"
                         class="w-full border rounded-xl pl-10 pr-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                         style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                         onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                         onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                </div>
              </div>

              <!-- Requestor Name -->
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Requestor Name <span style="color: #DC2626;">*</span></label>
                <div class="relative">
                  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none" style="color: #94A3B8;">person_outline</span>
                  <select formControlName="requestorName"
                          class="w-full border rounded-xl pl-10 pr-10 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 appearance-none"
                          style="background: rgba(30,41,59,0.7) url('${SELECT_SVG}') no-repeat right 10px center / 20px 20px; border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                    <option>Gurrammaneesh User</option>
                    <option>John Doe</option>
                  </select>
                </div>
              </div>

              <!-- Requesting Department -->
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Requesting Department <span style="color: #DC2626;">*</span></label>
                <div class="relative">
                  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none" style="color: #94A3B8;">domain</span>
                  <select formControlName="requestingDepartment"
                          class="w-full border rounded-xl pl-10 pr-10 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 appearance-none"
                          style="background: rgba(30,41,59,0.7) url('${SELECT_SVG}') no-repeat right 10px center / 20px 20px; border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                    <option>Business Unit - Medical</option>
                    <option>Operations</option>
                    <option>Finance</option>
                  </select>
                </div>
              </div>

              <!-- Project Status -->
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Project Status <span style="color: #DC2626;">*</span></label>
                <div class="relative">
                  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none" style="color: #94A3B8;">flag</span>
                  <select formControlName="projectStatus"
                          class="w-full border rounded-xl pl-10 pr-10 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 appearance-none"
                          style="background: rgba(30,41,59,0.7) url('${SELECT_SVG}') no-repeat right 10px center / 20px 20px; border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                    <option>New Request</option>
                    <option>In Progress</option>
                  </select>
                </div>
              </div>

              <!-- Project Type -->
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Project Type <span style="color: #DC2626;">*</span></label>
                <div class="relative">
                  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none" style="color: #94A3B8;">category</span>
                  <select formControlName="projectType"
                          class="w-full border rounded-xl pl-10 pr-10 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 appearance-none"
                          style="background: rgba(30,41,59,0.7) url('${SELECT_SVG}') no-repeat right 10px center / 20px 20px; border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                    <option>Digital Transformation</option>
                    <option>Infrastructure</option>
                    <option>Software Development</option>
                  </select>
                </div>
              </div>

              <!-- Primary BTA -->
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Primary BTA <span style="color: #DC2626;">*</span></label>
                <div class="relative">
                  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none" style="color: #94A3B8;">badge</span>
                  <select formControlName="primaryBTA"
                          class="w-full border rounded-xl pl-10 pr-10 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 appearance-none"
                          style="background: rgba(30,41,59,0.7) url('${SELECT_SVG}') no-repeat right 10px center / 20px 20px; border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                    <option>Select Primary BTA</option>
                    <option>Jane Architecture</option>
                    <option>Bob System</option>
                  </select>
                </div>
              </div>

              <!-- Target Business Department -->
              <div class="col-span-2">
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Target Business Department <span style="color: #DC2626;">*</span></label>
                <textarea formControlName="targetBusinessDepartment" rows="3"
                          class="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                          style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';"></textarea>
                <p class="text-[11px] mt-1.5" style="color: #94A3B8;">Briefly describe the target business department and stakeholders</p>
              </div>
            </div>
          }

          <!-- ── 2. BUSINESS OBJECTIVES ── -->
          @if(currentSectionIndex() === 1) {
            <div class="grid grid-cols-1 gap-5 animate-fade-in">
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Problem Statement <span style="color: #DC2626;">*</span></label>
                <textarea formControlName="problemStatement" rows="4" placeholder="What is the current pain point or challenge?"
                          class="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                          style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';"></textarea>
              </div>
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Business Objective <span style="color: #DC2626;">*</span></label>
                <textarea formControlName="businessObjective" rows="4" placeholder="What are the goals of this initiative?"
                          class="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                          style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';"></textarea>
              </div>
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Business Value / ROI</label>
                <textarea formControlName="businessValue" rows="4" placeholder="Describe the expected return on investment or value generated"
                          class="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                          style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';"></textarea>
              </div>
            </div>
          }

          <!-- ── 3. SCOPE & REQUIREMENTS ── -->
          @if(currentSectionIndex() === 2) {
            <div class="grid grid-cols-1 gap-5 animate-fade-in">
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Strategic Alignment</label>
                <textarea formControlName="strategicAlignment" rows="3" placeholder="How does this align with company goals?"
                          class="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                          style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';"></textarea>
              </div>
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">In Scope Items <span style="color: #DC2626;">*</span></label>
                <textarea formControlName="inScope" rows="3"
                          class="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                          style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';"></textarea>
              </div>
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Out of Scope Items</label>
                <textarea formControlName="outOfScope" rows="3"
                          class="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                          style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';"></textarea>
              </div>
            </div>
          }

          <!-- ── 4. TECHNICAL LANDSCAPE ── -->
          @if(currentSectionIndex() === 3) {
            <div class="grid grid-cols-2 gap-5 animate-fade-in">
              <div class="p-5 rounded-xl" style="background: rgba(30,41,59,0.5); border: 1px solid rgba(255,255,255,0.1);">
                <label class="block text-sm font-bold mb-4 text-center" style="color: #CBD5E1;">Is this a new or existing solution modification?</label>
                <div class="flex items-center justify-center gap-5">
                  <label class="flex items-center gap-2 text-sm cursor-pointer" style="color: #CBD5E1;">
                    <input type="radio" formControlName="isNewSolution" [value]="true" class="w-4 h-4" style="accent-color: #4F46E5;">
                    New Solution
                  </label>
                  <label class="flex items-center gap-2 text-sm cursor-pointer" style="color: #CBD5E1;">
                    <input type="radio" formControlName="isNewSolution" [value]="false" class="w-4 h-4" style="accent-color: #4F46E5;">
                    Existing Modification
                  </label>
                </div>
              </div>
              <div class="p-5 rounded-xl" style="background: rgba(30,41,59,0.5); border: 1px solid rgba(255,255,255,0.1);">
                <label class="block text-sm font-bold mb-4 text-center" style="color: #CBD5E1;">Is IT Involvement Required?</label>
                <div class="flex items-center justify-center gap-5">
                  <label class="flex items-center gap-2 text-sm cursor-pointer" style="color: #CBD5E1;">
                    <input type="radio" formControlName="itInvolvement" [value]="true" class="w-4 h-4" style="accent-color: #4F46E5;">
                    Yes, requires IT
                  </label>
                  <label class="flex items-center gap-2 text-sm cursor-pointer" style="color: #CBD5E1;">
                    <input type="radio" formControlName="itInvolvement" [value]="false" class="w-4 h-4" style="accent-color: #4F46E5;">
                    No
                  </label>
                </div>
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Systems Impacted</label>
                <div class="relative">
                  <span class="material-icons absolute left-3 top-3 text-[18px] pointer-events-none" style="color: #94A3B8;">dns</span>
                  <textarea formControlName="systemsImpacted" rows="3" placeholder="List environments, databases, or third-party systems impacted"
                            class="w-full border rounded-xl pl-10 pr-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                            style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                            onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                            onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';"></textarea>
                </div>
              </div>
            </div>
          }

          <!-- ── 5. DATA SECURITY & PRIVACY ── -->
          @if(currentSectionIndex() === 4) {
            <div class="grid grid-cols-2 gap-5 animate-fade-in">
              <div class="p-5 rounded-xl" style="background: rgba(30,41,59,0.5); border: 1px solid rgba(255,255,255,0.1);">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" formControlName="hasPhiData" class="w-5 h-5 rounded" style="accent-color: #4F46E5;">
                  <div>
                    <span class="block text-sm font-bold" style="color: #F1F5F9;">Contains PHI/PII Data</span>
                    <span class="block text-xs mt-0.5" style="color: #64748B;">Protected Health Information or Personally Identifiable Info</span>
                  </div>
                </label>
              </div>
              <div class="p-5 rounded-xl" style="background: rgba(30,41,59,0.5); border: 1px solid rgba(255,255,255,0.1);">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" formControlName="isHipaaApplicable" class="w-5 h-5 rounded" style="accent-color: #4F46E5;">
                  <div>
                    <span class="block text-sm font-bold" style="color: #F1F5F9;">HIPAA Compliance Applicable</span>
                    <span class="block text-xs mt-0.5" style="color: #64748B;">Requires strict audit logging and encryption at rest</span>
                  </div>
                </label>
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Data Classification <span style="color: #DC2626;">*</span></label>
                <select formControlName="dataClassification"
                        class="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 appearance-none"
                        style="background: rgba(30,41,59,0.7) url('${SELECT_SVG}') no-repeat right 12px center / 20px 20px; border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                        onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                        onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                  <option value="">Select Data Classification</option>
                  <option value="restricted">Restricted / Confidential</option>
                  <option value="internal">Internal Restricted</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>
          }

          <!-- ── 6. FINANCIALS & RESOURCES ── -->
          @if(currentSectionIndex() === 5) {
            <div class="grid grid-cols-2 gap-5 animate-fade-in">
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Estimated Budget <span style="color: #DC2626;">*</span></label>
                <div class="relative">
                  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none" style="color: #94A3B8;">attach_money</span>
                  <input type="number" formControlName="budgetEstimated" placeholder="0.00"
                         class="w-full border rounded-xl pl-10 pr-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                         style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                         onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                         onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                </div>
              </div>
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Budget Type <span style="color: #DC2626;">*</span></label>
                <select formControlName="budgetType"
                        class="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 appearance-none"
                        style="background: rgba(30,41,59,0.7) url('${SELECT_SVG}') no-repeat right 12px center / 20px 20px; border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                        onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                        onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                  <option value="capex">CapEx (Capital Expenditure)</option>
                  <option value="opex">OpEx (Operational Expenditure)</option>
                  <option value="tbd">To Be Determined</option>
                </select>
              </div>
              <div class="col-span-2 flex items-center justify-between p-5 rounded-xl" style="background: rgba(30,41,59,0.5); border: 1px solid rgba(255,255,255,0.1);">
                <div>
                  <span class="block text-sm font-bold" style="color: #F1F5F9;">Vendor Involvement Required?</span>
                  <span class="block text-xs mt-0.5" style="color: #64748B;">Will third-party external resources be utilized?</span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" formControlName="vendorRequired" class="sr-only peer">
                  <div class="w-11 h-6 rounded-full peer transition-all duration-300 peer-focus:ring-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"
                       [style]="'background: rgba(255,255,255,0.15)'"></div>
                </label>
              </div>
            </div>
          }

          <!-- ── 7. TIMELINE & URGENCY ── -->
          @if(currentSectionIndex() === 6) {
            <div class="grid grid-cols-2 gap-5 animate-fade-in">
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Requested Start Date <span style="color: #DC2626;">*</span></label>
                <div class="relative">
                  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none" style="color: #94A3B8;">event</span>
                  <input type="date" formControlName="requestedStartDate"
                         class="w-full border rounded-xl pl-10 pr-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                         style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                         onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                         onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                </div>
              </div>
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Requested End Date <span style="color: #DC2626;">*</span></label>
                <div class="relative">
                  <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none" style="color: #94A3B8;">event_available</span>
                  <input type="date" formControlName="requestedEndDate"
                         class="w-full border rounded-xl pl-10 pr-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200"
                         style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                         onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                         onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                </div>
              </div>
              <div class="col-span-1">
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Project Priority <span style="color: #DC2626;">*</span></label>
                <select formControlName="priority"
                        class="w-full border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 appearance-none"
                        style="background: rgba(30,41,59,0.7) url('${SELECT_SVG}') no-repeat right 12px center / 20px 20px; border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                        onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                        onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>
          }

          <!-- ── 8. DEPENDENCIES & RISKS ── -->
          @if(currentSectionIndex() === 7) {
            <div class="grid grid-cols-1 gap-5 animate-fade-in">
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Risk Level <span style="color: #DC2626;">*</span></label>
                <select formControlName="riskLevel"
                        class="w-1/2 border rounded-xl px-4 py-2.5 text-[13px] font-medium outline-none transition-all duration-200 appearance-none"
                        style="background: rgba(30,41,59,0.7) url('${SELECT_SVG}') no-repeat right 12px center / 20px 20px; border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                        onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                        onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';">
                  <option value="HIGH">High Risk</option>
                  <option value="MEDIUM">Medium Risk</option>
                  <option value="LOW">Low Risk</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Known Risks & Mitigation Plans</label>
                <textarea formControlName="knownRisks" rows="3"
                          class="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                          style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';"></textarea>
              </div>
              <div>
                <label class="block text-xs font-bold mb-1.5" style="color: #CBD5E1;">Key Dependencies</label>
                <textarea formControlName="dependencies" rows="3"
                          class="w-full border rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all duration-200 resize-y"
                          style="background: rgba(30,41,59,0.7); border-color: rgba(255,255,255,0.12); color: #F1F5F9;"
                          onfocus="this.style.borderColor='rgba(79,70,229,0.5)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.10)';"
                          onblur="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.boxShadow='none';"></textarea>
              </div>
            </div>
          }

          <!-- ── 9. BTA CHECKLIST ── -->
          @if(currentSectionIndex() === 8) {
            <div class="animate-fade-in space-y-6">
              <h3 class="text-[13px] font-extrabold uppercase tracking-widest mb-2" style="color: #34D399;">BTA Gate Reviewer Checklist</h3>
              <app-gateway-checklist [projectId]="projectId" gateOwner="BTA"></app-gateway-checklist>
            </div>
          }

        </form>

        <!-- ── NAVIGATION ACTIONS ── -->
        <div class="mt-10 flex items-center justify-between" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
          <button type="button"
                  class="px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200"
                  style="background: rgba(30,41,59,0.7); color: #94A3B8; border: 1.5px solid rgba(255,255,255,0.12);"
                  onmouseenter="this.style.borderColor='rgba(248,113,113,0.4)'; this.style.color='#F87171'; this.style.background='rgba(220,38,38,0.12)';"
                  onmouseleave="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.color='#94A3B8'; this.style.background='rgba(30,41,59,0.7)';">
            Cancel
          </button>

          <div class="flex gap-3">
            <button type="button"
                    class="px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200"
                    [class.invisible]="currentSectionIndex() === 0"
                    (click)="previousSection()"
                    style="background: rgba(30,41,59,0.7); color: #CBD5E1; border: 1.5px solid rgba(255,255,255,0.12);"
                    onmouseenter="this.style.background='rgba(30,41,59,0.9)'; this.style.borderColor='rgba(129,140,248,0.4)';"
                    onmouseleave="this.style.background='rgba(30,41,59,0.7)'; this.style.borderColor='rgba(255,255,255,0.12)';">
              ← Previous
            </button>

            @if (currentSectionIndex() < sections.length - 1) {
              <button type="button"
                      class="px-8 py-2.5 rounded-xl text-white text-[13px] font-bold transition-all duration-200 flex items-center gap-2"
                      (click)="nextSection()"
                      style="background: linear-gradient(135deg, #4F46E5, #7C3AED); box-shadow: 0 4px 14px rgba(79,70,229,0.35);"
                      onmouseenter="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 8px 20px rgba(79,70,229,0.5)';"
                      onmouseleave="this.style.transform=''; this.style.boxShadow='0 4px 14px rgba(79,70,229,0.35)';">
                Next <span class="material-icons text-[16px]">arrow_forward</span>
              </button>
            } @else {
              <button type="button"
                      class="px-8 py-2.5 rounded-xl text-white text-[13px] font-bold transition-all duration-200 flex items-center gap-2"
                      (click)="submitData()"
                      style="background: linear-gradient(135deg, #059669, #047857); box-shadow: 0 4px 14px rgba(5,150,105,0.35);"
                      onmouseenter="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 8px 20px rgba(5,150,105,0.5)';"
                      onmouseleave="this.style.transform=''; this.style.boxShadow='0 4px 14px rgba(5,150,105,0.35)';">
                <span class="material-icons text-[16px]">check_circle_outline</span> Complete Review
              </button>
            }
          </div>
        </div>

      </div> <!-- Closes FORM CONTENT CARD -->

      </div> <!-- Closes Grid -->

    </div>
  `
})
export class BtaReviewComponent implements OnInit {
  fb = inject(FormBuilder);
  router = inject(Router);
  projectService = inject(ProjectService);
  btaRequestService = inject(BtaRequestService);

  @Input() embeddedMode = false;
  @Input() forceReviewScreen = false;
  @Input() isExtracting = false;
  @Input() availableDocuments = 0;

  @Output() triggerAiExtraction = new EventEmitter<void>();

  @Input() set autoPopulatedData(data: any) {
      if (data && Object.keys(data).length > 0) {
          this.btaForm.patchValue(data);
      }
  }

  @Input() projectId: string = '';

  currentSectionIndex = signal<number>(0);

  sections = [
    { title: 'Project Identification', icon: 'architecture', description: 'Provide basic information about your project' },
    { title: 'Business Objective', icon: 'lightbulb', description: 'Define the core problem and expected business value' },
    { title: 'Scope & Requirements', icon: 'fact_check', description: 'Outline what is included and excluded from this initiative' },
    { title: 'Technical Landscape', icon: 'dns', description: 'Detail the system architecture and IT involvement' },
    { title: 'Data Security & Privacy', icon: 'security', description: 'Declare data classifications and strict compliance requirements' },
    { title: 'Financials & Resources', icon: 'payments', description: 'Estimate capital and operational budget resources needed' },
    { title: 'Timeline & Urgency', icon: 'calendar_month', description: 'Set targeted dates and priority levels' },
    { title: 'Dependencies & Risks', icon: 'warning', description: 'Highlight any blocking dependencies or risk factors' },
    { title: 'BTA Checklist', icon: 'fact_check', description: 'Confirm all mandatory BTA approvals and verification items' }
  ];

  btaForm: FormGroup = this.fb.group({
    projectName: ['Data Automation Initiative', Validators.required],
    requestorName: ['Gurrammaneesh User', Validators.required],
    requestingDepartment: ['Business Unit - Medical', Validators.required],
    projectStatus: ['New Request', Validators.required],
    projectType: ['Digital Transformation', Validators.required],
    primaryBTA: ['Select Primary BTA', Validators.required],
    targetBusinessDepartment: ['Operations, Quality Assurance, and Compliance', Validators.required],
    problemStatement: ['', Validators.required],
    businessObjective: ['', Validators.required],
    businessValue: [''],
    strategicAlignment: [''],
    inScope: ['', Validators.required],
    outOfScope: [''],
    isNewSolution: [true],
    itInvolvement: [true],
    systemsImpacted: [''],
    hasPhiData: [false],
    isHipaaApplicable: [false],
    dataClassification: ['', Validators.required],
    budgetEstimated: [null, Validators.required],
    budgetType: ['tbd', Validators.required],
    vendorRequired: [false],
    requestedStartDate: [null, Validators.required],
    requestedEndDate: [null, Validators.required],
    priority: ['MEDIUM', Validators.required],
    riskLevel: ['MEDIUM', Validators.required],
    knownRisks: [''],
    dependencies: ['']
  });

  ngOnInit() {
    if (this.embeddedMode) {
      return;
    }
    const state = history.state;
    if (state && state.projectId) {
      this.projectId = state.projectId;
    }
  }

  setSection(index: number) { this.currentSectionIndex.set(index); }
  nextSection() { if (this.currentSectionIndex() < this.sections.length - 1) this.currentSectionIndex.update(i => i + 1); }
  previousSection() { if (this.currentSectionIndex() > 0) this.currentSectionIndex.update(i => i - 1); }

  onExtractClicked() {
      if (this.isExtracting) return;
      if (this.availableDocuments === 0) {
          alert("Please upload documents in the 'Documents' tab first before using AI Auto-Population.");
          return;
      }
      this.triggerAiExtraction.emit();
  }

  submitData() {
    if(!this.projectId) {
        alert("Visual Preview: Form Completed!");
        return;
    }
    this.projectService.submitDecision(this.projectId, 'BTA Review', 'Provide BTA Recommendation', 'BTA Verified and passed to EAC.', this.btaForm.value)
      .subscribe({
        next: () => {
          alert("BTA completed successfully!");
          this.router.navigate(['/team-inbox']);
        },
        error: (err) => alert("Error submitting request.")
      });
  }
}
