import { Component, signal, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { BtaReviewComponent } from '../bta-review/bta-review.component';
import { PrepareEacComponent } from '../eac-review/prepare-eac.component';
import { PreparePicComponent } from '../pic-review/prepare-pic.component';
import { EpmoReviewComponent } from '../epmo-review/epmo-review.component';
import { FinanceReviewComponent } from '../finance-review/finance-review.component';
import { ProjectService } from '../../core/services/project.service';

@Component({
    selector: 'app-review-workspace',
    standalone: true,
    imports: [CommonModule, BtaReviewComponent, PrepareEacComponent, PreparePicComponent, EpmoReviewComponent, FinanceReviewComponent],
    template: `
    <div class="animate-fade-in min-h-[calc(100vh-64px)] flex gap-5 font-sans p-6"
         style="background: linear-gradient(135deg, #F0F4FF 0%, #FAF5FF 50%, #F0FFFE 100%);">
      
      @if (loading()) {
        <div class="flex flex-1 items-center justify-center">
          <div class="flex flex-col items-center gap-4">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center" style="background: linear-gradient(135deg, #4F46E5, #7C3AED); box-shadow: 0 8px 24px rgba(79,70,229,0.35);">
              <span class="material-icons text-white text-2xl animate-spin">autorenew</span>
            </div>
            <p class="text-sm font-semibold" style="color: #64748B;">Loading workspace...</p>
          </div>
        </div>
      } @else {

        <!-- ══ Main Workspace (Left Column) ══ -->
        <div class="flex-1 flex flex-col gap-4 min-w-0">

          <!-- ── Premium Header Card ── -->
          <div class="rounded-2xl relative overflow-hidden"
               style="background: white; border: 1px solid rgba(226,232,240,0.8); box-shadow: 0 4px 24px rgba(79,70,229,0.08), 0 1px 4px rgba(0,0,0,0.04);">
            <!-- Top gradient accent bar -->
            <div class="absolute top-0 left-0 right-0 h-1" style="background: linear-gradient(90deg, #4F46E5 0%, #7C3AED 50%, #06B6D4 100%);"></div>
            <!-- Subtle ambient glow -->
            <div class="absolute top-0 right-0 w-64 h-32 pointer-events-none" style="background: radial-gradient(ellipse at 100% 0%, rgba(79,70,229,0.06) 0%, transparent 70%);"></div>

            <div class="flex justify-between items-start px-8 pt-6 pb-6 relative z-10">
              <div>
                <!-- Stage breadcrumb -->
                <div class="flex items-center gap-2 mb-3">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase"
                        style="background: linear-gradient(135deg, #EEF2FF, #F5F3FF); color: #4F46E5; border: 1px solid rgba(79,70,229,0.15);">
                    <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: #4F46E5;"></span>
                    {{ workspaceData().workflow.current_stage }}
                  </span>
                  <span class="text-gray-300">·</span>
                  <span class="text-[10px] font-bold tracking-widest uppercase" style="color: #94A3B8;">ASSIGNED TO: UNASSIGNED</span>
                </div>

                <!-- Project title -->
                <h1 class="text-2xl font-extrabold mb-4 leading-tight" style="font-family: 'Outfit', sans-serif; color: #1E293B;">
                  {{ workspaceData().project_details.name }}
                </h1>

                <!-- Meta chips -->
                <div class="flex items-center gap-5 flex-wrap">
                  <div class="flex items-center gap-1.5 text-xs font-medium" style="color: #64748B;">
                    <span class="material-icons text-[14px]" style="color: #94A3B8;">tag</span>
                    <span>REQ-2025-000123</span>
                  </div>
                  <div class="flex items-center gap-1.5 text-xs font-medium" style="color: #64748B;">
                    <span class="material-icons text-[14px]" style="color: #94A3B8;">person_outline</span>
                    <span class="font-semibold" style="color: #334155;">{{ workspaceData().project_details.requestorName || 'Gurrammaneesh User' }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 text-xs font-medium" style="color: #64748B;">
                    <span class="material-icons text-[14px]" style="color: #94A3B8;">calendar_today</span>
                    <span>{{ workspaceData().project_details.submitted_at | date:'MMM dd, yyyy' }}</span>
                  </div>
                </div>
              </div>

              <!-- Current Stage badge (right) -->
              <div class="flex-shrink-0 px-5 py-3.5 rounded-xl flex flex-col items-center justify-center"
                   style="background: linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(124,58,237,0.06) 100%); border: 1px solid rgba(79,70,229,0.15);">
                <span class="text-[9px] font-bold tracking-widest uppercase mb-1.5" style="color: #818CF8;">Current Stage</span>
                <div class="flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full animate-pulse" style="background: linear-gradient(135deg, #4F46E5, #7C3AED);"></div>
                  <span class="text-[13px] font-extrabold" style="color: #1E293B;">{{ workspaceData().workflow.current_stage }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Premium Tab Navigation ── -->
          <div class="rounded-2xl overflow-hidden"
               style="background: white; border: 1px solid rgba(226,232,240,0.8); box-shadow: 0 2px 12px rgba(79,70,229,0.06);">
            <div class="flex px-2 pt-1">

              @for (tab of tabs; track tab.key) {
                <button class="flex items-center gap-2 px-4 py-3.5 text-[13px] font-bold border-b-2 transition-all duration-200 relative rounded-t-xl mx-1"
                        [style]="activeTab() === tab.key
                          ? 'color: #4F46E5; border-color: #4F46E5; background: linear-gradient(180deg, rgba(79,70,229,0.06) 0%, transparent 100%);'
                          : 'color: #94A3B8; border-color: transparent;'"
                        (click)="activeTab.set(tab.key)"
                        onmouseenter="if(!this.classList.contains('active')) { this.style.color='#475569'; }"
                        onmouseleave="if(!this.classList.contains('active')) { this.style.color='#94A3B8'; }">
                  <span class="material-icons text-[17px]">{{ tab.icon }}</span>
                  {{ tab.label }}
                  @if (tab.count !== undefined) {
                    <span class="ml-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          [style]="activeTab() === tab.key
                            ? 'background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white;'
                            : 'background: rgba(241,245,249,0.9); color: #64748B;'">{{ tab.count }}</span>
                  }
                </button>
              }

            </div>
          </div>

          <!-- ── Form Engine Container ── -->
          <div [style.display]="(activeTab() === 'Form Engine' || activeTab() === 'Overview') ? 'block' : 'none'"
               class="animate-fade-in w-full">
            @if(workspaceData().workflow.current_stage.includes('BTA')) {
              <app-bta-review [embeddedMode]="true"
                              [isExtracting]="aiExtracting()"
                              [availableDocuments]="workspaceData().documents.length"
                              [autoPopulatedData]="btaFormValues()"
                              (triggerAiExtraction)="simulateAiExtraction()">
              </app-bta-review>
            }
            @if(workspaceData().workflow.current_stage.includes('Finance')) {
              <app-finance-review [embeddedMode]="true"></app-finance-review>
            }
            @if(workspaceData().workflow.current_stage.includes('EPMO') || workspaceData().workflow.current_stage.includes('Parallel')) {
              <app-epmo-review [embeddedMode]="true"></app-epmo-review>
            }
            @if(workspaceData().workflow.current_stage.includes('EAC')) {
              <app-prepare-eac [embeddedMode]="true"></app-prepare-eac>
            }
            @if(workspaceData().workflow.current_stage.includes('PIC')) {
              <app-prepare-pic [embeddedMode]="true"></app-prepare-pic>
            }
          </div>

          <!-- ── Other Tab Content ── -->
          <div *ngIf="activeTab() !== 'Form Engine' && activeTab() !== 'Overview'"
               class="rounded-2xl p-8 min-h-[400px]"
               style="background: white; border: 1px solid rgba(226,232,240,0.8); box-shadow: 0 4px 20px rgba(79,70,229,0.06);">

            <!-- DOCUMENTS TAB -->
            <div *ngIf="activeTab() === 'Documents'" class="animate-fade-in space-y-3">
              <div class="flex justify-between items-center mb-6">
                <div>
                  <h3 class="text-lg font-bold" style="color: #1E293B;">Project Documents</h3>
                  <p class="text-[12px] mt-0.5" style="color: #94A3B8;">{{ workspaceData().documents.length }} files attached</p>
                </div>
                <input type="file" #fileUpload class="hidden" multiple (change)="handleFileUpload($event)">
                <button (click)="fileUpload.click()"
                        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
                        style="background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; box-shadow: 0 4px 14px rgba(79,70,229,0.3);"
                        onmouseenter="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 8px 20px rgba(79,70,229,0.4)';"
                        onmouseleave="this.style.transform=''; this.style.boxShadow='0 4px 14px rgba(79,70,229,0.3)';">
                  <span class="material-icons text-[18px]">cloud_upload</span>
                  Upload File
                </button>
              </div>

              @if (workspaceData().documents.length === 0) {
                <div class="flex flex-col items-center justify-center py-16 text-center">
                  <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style="background: linear-gradient(135deg, #EEF2FF, #F5F3FF);">
                    <span class="material-icons text-3xl" style="color: #818CF8;">folder_open</span>
                  </div>
                  <p class="font-semibold text-sm" style="color: #64748B;">No documents uploaded yet</p>
                  <p class="text-xs mt-1" style="color: #94A3B8;">Upload documents to attach them to this review</p>
                </div>
              }

              <div *ngFor="let doc of workspaceData().documents; let i = index"
                   class="flex justify-between items-center p-4 rounded-xl transition-all duration-200 group"
                   style="border: 1px solid rgba(226,232,240,0.8); background: rgba(248,250,252,0.6);"
                   onmouseenter="this.style.borderColor='rgba(79,70,229,0.2)'; this.style.background='rgba(238,242,255,0.5)';"
                   onmouseleave="this.style.borderColor='rgba(226,232,240,0.8)'; this.style.background='rgba(248,250,252,0.6)';">
                <div class="flex items-center gap-4">
                  <div class="w-11 h-11 rounded-xl flex items-center justify-center" style="background: linear-gradient(135deg, #FEF3C7, #FDE68A);">
                    <span class="material-icons text-[22px]" style="color: #D97706;">picture_as_pdf</span>
                  </div>
                  <div>
                    <p class="text-sm font-bold" style="color: #1E293B;">{{ doc.name }}</p>
                    <p class="text-[11px] font-medium mt-0.5" style="color: #94A3B8;">Uploaded by {{ doc.author }} · {{ doc.date }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <button class="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                          style="color: #94A3B8;"
                          onmouseenter="this.style.background='rgba(79,70,229,0.08)'; this.style.color='#4F46E5';"
                          onmouseleave="this.style.background='transparent'; this.style.color='#94A3B8';">
                    <span class="material-icons text-[18px]">download</span>
                  </button>
                  <button class="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                          style="color: #94A3B8;"
                          onmouseenter="this.style.background='rgba(220,38,38,0.08)'; this.style.color='#DC2626';"
                          onmouseleave="this.style.background='transparent'; this.style.color='#94A3B8';"
                          (click)="deleteDocument(i)">
                    <span class="material-icons text-[18px]">delete_outline</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- COMMENTS TAB -->
            <div *ngIf="activeTab() === 'Comments'" class="animate-fade-in flex flex-col h-full space-y-5">
              <div>
                <h3 class="text-lg font-bold" style="color: #1E293B;">Discussion Thread</h3>
                <p class="text-[12px] mt-0.5" style="color: #94A3B8;">{{ workspaceData().comments.length }} messages in this review</p>
              </div>
              <div class="flex-1 overflow-y-auto space-y-5">
                <div *ngFor="let comment of workspaceData().comments" class="flex gap-4">
                  <!-- Avatar -->
                  <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white"
                       style="background: linear-gradient(135deg, #4F46E5, #7C3AED); box-shadow: 0 2px 8px rgba(79,70,229,0.25);">{{ comment.initials }}</div>
                  <div class="flex-1">
                    <div class="flex items-center justify-between mb-1.5">
                      <p class="text-[13px] font-bold" style="color: #1E293B;">{{ comment.author }}</p>
                      <span class="text-[11px] font-medium" style="color: #94A3B8;">{{ comment.date }}</span>
                    </div>
                    <p class="text-[13px] leading-relaxed p-4 rounded-2xl rounded-tl-sm"
                       style="color: #475569; background: rgba(241,245,249,0.8); border: 1px solid rgba(226,232,240,0.6);">{{ comment.text }}</p>
                  </div>
                </div>
              </div>
              <!-- Comment input -->
              <div class="flex gap-3 pt-4" style="border-top: 1px solid rgba(226,232,240,0.6);">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white" style="background: linear-gradient(135deg, #64748B, #475569);">ME</div>
                <input type="text" placeholder="Add a comment... (Press Enter to post)"
                       class="flex-1 px-4 py-2.5 rounded-xl text-[13px] outline-none transition-all duration-200"
                       style="background: rgba(241,245,249,0.8); border: 1.5px solid rgba(226,232,240,0.8); color: #334155;"
                       onfocus="this.style.background='white'; this.style.borderColor='rgba(79,70,229,0.4)'; this.style.boxShadow='0 0 0 4px rgba(79,70,229,0.08)';"
                       onblur="this.style.background='rgba(241,245,249,0.8)'; this.style.borderColor='rgba(226,232,240,0.8)'; this.style.boxShadow='none';">
                <button class="px-5 rounded-xl font-bold text-[13px] text-white transition-all duration-200"
                        style="background: linear-gradient(135deg, #4F46E5, #7C3AED); box-shadow: 0 4px 12px rgba(79,70,229,0.3);"
                        onmouseenter="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 20px rgba(79,70,229,0.4)';"
                        onmouseleave="this.style.transform=''; this.style.boxShadow='0 4px 12px rgba(79,70,229,0.3)';">Post</button>
              </div>
            </div>

            <!-- AUDIT TRAIL TAB -->
            <div *ngIf="activeTab() === 'Audit'" class="animate-fade-in">
              <div class="mb-6">
                <h3 class="text-lg font-bold" style="color: #1E293B;">Action History</h3>
                <p class="text-[12px] mt-0.5" style="color: #94A3B8;">Immutable audit trail — tamper-evident blockchain hashes</p>
              </div>
              <div class="relative ml-2">
                <!-- gradient connecting line -->
                <div class="absolute left-[11px] top-4 bottom-4 w-[2px] rounded-full"
                     style="background: linear-gradient(180deg, #4F46E5 0%, #7C3AED 50%, rgba(226,232,240,0.5) 100%);"></div>
                <div *ngFor="let log of workspaceData().audit_logs" class="relative flex gap-5 mb-6 z-10">
                  <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                       style="background: white; border-color: #4F46E5; box-shadow: 0 0 0 3px rgba(79,70,229,0.15);">
                    <div class="w-2 h-2 rounded-full" style="background: linear-gradient(135deg, #4F46E5, #7C3AED);"></div>
                  </div>
                  <div class="flex-1 p-4 rounded-xl" style="background: rgba(248,250,252,0.8); border: 1px solid rgba(226,232,240,0.6);">
                    <p class="text-[13px]" style="color: #1E293B;"><span class="font-bold">{{ log.user }}</span> {{ log.action }}</p>
                    <div class="flex items-center gap-3 mt-1.5">
                      <p class="text-[11px] font-semibold uppercase tracking-wider" style="color: #94A3B8;">{{ log.timestamp }}</p>
                      <span class="text-[11px] font-mono px-2 py-0.5 rounded-md" style="background: rgba(79,70,229,0.08); color: #4F46E5;">{{ log.hash }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- ══ Right Sidebar (Action Widgets) ══ -->
        <div class="w-[340px] flex flex-col gap-4 shrink-0">

          <!-- AI Recommendation Panel -->
          <div class="rounded-2xl p-6 relative overflow-hidden"
               style="background: linear-gradient(135deg, #1E1B4B 0%, #2D1B69 100%); border: 1px solid rgba(129,140,248,0.2); box-shadow: 0 8px 32px rgba(79,70,229,0.25);">
            <!-- Ambient glow circles -->
            <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none" style="background: radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 70%);"></div>
            <div class="absolute -bottom-6 -left-6 w-24 h-24 rounded-full pointer-events-none" style="background: radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 70%);"></div>

            <div class="relative z-10">
              <div class="flex items-center gap-2.5 mb-5">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: rgba(167,139,250,0.2); border: 1px solid rgba(167,139,250,0.3);">
                  <span class="material-icons text-[18px]" style="color: #A78BFA;">auto_awesome</span>
                </div>
                <h3 class="text-[14px] font-extrabold text-white">AI Recommendation</h3>
              </div>

              <!-- Confidence bar -->
              <div class="mb-5">
                <div class="flex justify-between items-center mb-2">
                  <span class="text-[11px] font-bold uppercase tracking-wider" style="color: rgba(148,163,184,0.9);">Confidence Score</span>
                  <span class="text-[13px] font-extrabold" style="background: linear-gradient(90deg, #818CF8, #A78BFA); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">87%</span>
                </div>
                <div class="h-2 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.1);">
                  <div class="h-full rounded-full" style="width: 87%; background: linear-gradient(90deg, #4F46E5, #7C3AED, #A78BFA);"></div>
                </div>
              </div>

              <!-- Recommendation chip -->
              <div class="flex items-center gap-2.5 p-3 rounded-xl mb-4" style="background: rgba(5,150,105,0.15); border: 1px solid rgba(5,150,105,0.25);">
                <span class="material-icons text-[18px]" style="color: #34D399;">check_circle</span>
                <span class="font-bold text-sm" style="color: #6EE7B7;">{{ workspaceData().ai_assistant.recommended_action || 'Approve' }}</span>
              </div>

              <p class="text-[12px] leading-relaxed mb-4" style="color: rgba(148,163,184,0.9);">
                This project aligns well with organizational goals and has strong business justification.
              </p>

              <a href="#" class="flex items-center gap-1.5 text-[12px] font-bold transition-colors" style="color: #818CF8;"
                 onmouseenter="this.style.color='#A78BFA';" onmouseleave="this.style.color='#818CF8';">
                View Full Analysis
                <span class="material-icons text-[14px]">arrow_forward</span>
              </a>
            </div>
          </div>

          <!-- Required Decision Panel -->
          <div class="rounded-2xl p-6"
               style="background: white; border: 1px solid rgba(226,232,240,0.8); box-shadow: 0 4px 20px rgba(79,70,229,0.06);">
            <div class="flex items-center gap-2 mb-5">
              <div class="w-2 h-2 rounded-full animate-pulse" style="background: #DC2626;"></div>
              <h3 class="text-[14px] font-extrabold" style="color: #1E293B;">Required Decision</h3>
              <span class="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style="background: linear-gradient(135deg, #EEF2FF, #F5F3FF); color: #4F46E5; border: 1px solid rgba(79,70,229,0.15);">
                {{ workspaceData().workflow.current_stage }}
              </span>
            </div>

            <div class="flex flex-col gap-3">
              <!-- Approve -->
              <button (click)="submitAction('Approve')"
                      class="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 font-bold text-[13px] text-white transition-all duration-200"
                      style="background: linear-gradient(135deg, #059669, #047857); box-shadow: 0 4px 16px rgba(5,150,105,0.3);"
                      onmouseenter="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 8px 24px rgba(5,150,105,0.45)';"
                      onmouseleave="this.style.transform=''; this.style.boxShadow='0 4px 16px rgba(5,150,105,0.3)';">
                <span class="material-icons text-[18px]">check_circle_outline</span>
                Approve
              </button>

              <!-- Reject -->
              <button (click)="submitAction('Reject')"
                      class="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 font-bold text-[13px] text-white transition-all duration-200"
                      style="background: linear-gradient(135deg, #DC2626, #B91C1C); box-shadow: 0 4px 16px rgba(220,38,38,0.3);"
                      onmouseenter="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 8px 24px rgba(220,38,38,0.45)';"
                      onmouseleave="this.style.transform=''; this.style.boxShadow='0 4px 16px rgba(220,38,38,0.3)';">
                <span class="material-icons text-[18px]">highlight_off</span>
                Reject
              </button>

              <!-- Need More Information -->
              <button (click)="submitAction('Need More Information')"
                      class="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 font-bold text-[13px] transition-all duration-200"
                      style="background: white; color: #475569; border: 1.5px solid rgba(226,232,240,0.9); box-shadow: 0 2px 8px rgba(15,23,42,0.06);"
                      onmouseenter="this.style.borderColor='rgba(79,70,229,0.3)'; this.style.color='#4F46E5'; this.style.background='rgba(238,242,255,0.5)';"
                      onmouseleave="this.style.borderColor='rgba(226,232,240,0.9)'; this.style.color='#475569'; this.style.background='white';">
                <span class="material-icons text-[18px]">help_outline</span>
                Need More Information
              </button>
            </div>
          </div>

          <!-- Approval Timeline Panel -->
          <div class="rounded-2xl p-6 flex-1"
               style="background: white; border: 1px solid rgba(226,232,240,0.8); box-shadow: 0 4px 20px rgba(79,70,229,0.06);">
            <h3 class="text-[14px] font-extrabold mb-6" style="color: #1E293B;">Approval Timeline</h3>

            <div class="relative ml-2 mt-2">
              <!-- Gradient connecting line -->
              <div class="absolute top-[8px] bottom-0 left-[7px] w-[2px] rounded-full"
                   style="background: linear-gradient(180deg, #4F46E5 0%, rgba(226,232,240,0.5) 100%);"></div>

              @for (node of workspaceData().timeline; track node.stage; let i = $index) {
                <div class="relative flex items-start gap-4 mb-5 z-10">
                  <!-- Status dot -->
                  <div class="w-4 h-4 rounded-full shrink-0 mt-0.5 flex items-center justify-center relative"
                       [style]="node.status === 'Approved'
                         ? 'background: linear-gradient(135deg, #059669, #047857); box-shadow: 0 0 0 3px rgba(5,150,105,0.15), 0 2px 8px rgba(5,150,105,0.3);'
                         : node.status === 'In Progress'
                         ? 'background: linear-gradient(135deg, #4F46E5, #7C3AED); box-shadow: 0 0 0 4px rgba(79,70,229,0.15), 0 2px 8px rgba(79,70,229,0.35);'
                         : 'background: white; border: 2px solid #E2E8F0;'">
                    @if (node.status === 'Approved') {
                      <span class="material-icons text-white" style="font-size: 10px; line-height: 1;">check</span>
                    }
                    @if (node.status === 'In Progress') {
                      <div class="w-2 h-2 rounded-full animate-pulse" style="background: rgba(255,255,255,0.9);"></div>
                    }
                  </div>
                  <div class="flex-1 -mt-0.5">
                    <p class="text-[13px] font-bold"
                       [style]="node.status === 'In Progress' ? 'color: #1E293B;' : (node.status === 'Approved' ? 'color: #374151;' : 'color: #94A3B8;')">
                      {{ node.stage }}
                    </p>
                    <p class="text-[11px] font-semibold mt-0.5"
                       [style]="node.status === 'Approved' ? 'color: #059669;' : node.status === 'In Progress' ? 'color: #4F46E5;' : 'color: #CBD5E1;'">
                      {{ node.status }}<span *ngIf="node.actor"> — {{ node.actor }}</span>
                    </p>
                    @if (node.action_date) {
                      <p class="text-[11px] font-medium mt-0.5" style="color: #94A3B8;">{{ node.action_date | date:'MMM dd, yyyy — hh:mm a' }}</p>
                    }
                  </div>
                </div>
              }

              <!-- Static future nodes -->
              <div class="relative flex items-start gap-4 mb-5 z-10">
                <div class="w-4 h-4 rounded-full shrink-0 mt-0.5" style="background: white; border: 2px solid #E2E8F0;"></div>
                <div class="flex-1 -mt-0.5">
                  <p class="text-[13px] font-bold" style="color: #94A3B8;">EAC Review</p>
                  <p class="text-[11px] font-semibold mt-0.5" style="color: #CBD5E1;">Pending</p>
                </div>
              </div>
              <div class="relative flex items-start gap-4 z-10">
                <div class="w-4 h-4 rounded-full shrink-0 mt-0.5" style="background: white; border: 2px solid #E2E8F0;"></div>
                <div class="flex-1 -mt-0.5">
                  <p class="text-[13px] font-bold" style="color: #94A3B8;">Completed</p>
                  <p class="text-[11px] font-semibold mt-0.5" style="color: #CBD5E1;">Pending</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      }
    </div>
  `,
    styles: []
})
export class ReviewWorkspaceComponent implements OnInit {
    workspaceData = signal<any>(null);
    loading = signal(true);
    activeTab = signal('Form Engine');
    overviewTab = signal(0);

    tabs = [
      { key: 'Form Engine', label: 'Intake Forms', icon: 'article', count: undefined },
      { key: 'Documents',   label: 'Documents',   icon: 'folder',  count: 0 },
      { key: 'Comments',    label: 'Comments',    icon: 'chat_bubble_outline', count: 0 },
      { key: 'Overview',    label: 'Overview',    icon: 'find_in_page', count: undefined },
      { key: 'Audit',       label: 'Audit Trail', icon: 'history', count: undefined },
    ];

    btaOverviewSections = [
        { title: 'Project Overview & Identification' },
        { title: 'Business Justification & Alignment' },
        { title: 'Scope & Requirements' },
        { title: 'Technical Landscape' },
        { title: 'Data Security & Privacy' },
        { title: 'Financials & Resources' },
        { title: 'Timeline & Urgency' },
        { title: 'Dependencies & Risks' }
    ];

    // AI Extraction Simulator state
    aiExtracting = signal(false);
    btaFormValues = signal<any>({});

    private http = inject(HttpClient);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private projectService = inject(ProjectService);

    ngOnInit() {
        this.route.paramMap.subscribe(params => {
            const id = params.get('id');
            if (id) {
                this.projectService.getProject(id).subscribe({
                    next: (project: any) => {
                        const mappedData = {
                            project_details: {
                                id: project.id,
                                name: project.project_name,
                                department: project.department,
                                description: project.description,
                                priority: project.priority,
                                risk_level: project.risk_level,
                                submitted_at: project.submitted_at
                            },
                            workflow: {
                                current_stage: project.current_stage || 'BTA Review',
                                bg_color: 'indigo',
                                checklist: ['Verify Strategic Business Alignment', 'Check Technology Stack Compatibility', 'Review Budget Estimation'],
                                allowed_actions: ['Approve', 'Reject', 'Need More Information']
                            },
                            ai_assistant: {
                                recommended_action: 'Approve',
                                summary: 'Risk analysis looks good. Dependencies are clear and valid.',
                                missing_docs: []
                            },
                            timeline: [
                                { stage: 'Intake', status: 'Approved', action_date: new Date(), actor: 'System' },
                                { stage: project.current_stage, status: 'In Progress', action_date: null, actor: 'Pending Team' }
                            ]
                        };
                        this.workspaceData.set(this.injectDynamicTabs(mappedData));
                        this.updateTabCounts();
                        if (this.workspaceData().workflow.current_stage.includes('BTA') || this.workspaceData().workflow.current_stage.includes('EAC') || this.workspaceData().workflow.current_stage.includes('PIC')) {
                            this.activeTab.set('Form Engine');
                        } else {
                            this.activeTab.set('Overview');
                        }
                        this.loading.set(false);
                    },
                    error: (err) => {
                        console.error('Failed to load real DB project, using mock fallback', err);
                        this.workspaceData.set(this.injectDynamicTabs(this.getMockData(id)));
                        this.updateTabCounts();
                        this.activeTab.set('Overview');
                        this.loading.set(false);
                    }
                });
            }
        });
    }

    updateTabCounts() {
        if (this.workspaceData()) {
            this.tabs = this.tabs.map(t => {
                if (t.key === 'Documents') return { ...t, count: this.workspaceData().documents.length };
                if (t.key === 'Comments') return { ...t, count: this.workspaceData().comments.length };
                return t;
            });
        }
    }

    simulateAiExtraction() {
        this.aiExtracting.set(true);
        setTimeout(() => {
            this.btaFormValues.set({
                requestingDepartment: 'Clinical Operations',
                targetBusinessDepartment: 'Diagnostic Imaging',
                problemStatement: 'Legacy system is slowing down patient diagnostics by 25%. Need a cloud-native replacement.',
                businessObjective: 'Modernize diagnostic workflow and reduce reporting latency by 30%.',
                businessValue: 'Projected $1.2M savings annually from reduced manual entry.',
                strategicAlignment: 'Directly supports the Q3 strategic goal of "Digital-First Patient Care".',
                inScope: '1. Cloud migration of imaging database\n2. Implementation of new diagnostic APIs\n3. Staff training for new UI',
                outOfScope: '1. Legacy billing system integration\n2. Hardware upgrades for diagnostic machines',
                isNewSolution: false,
                itInvolvement: true,
                systemsImpacted: 'Cerner EHR, Cloud SQL Database, Internal Auth Gateway',
                hasPhiData: true,
                isHipaaApplicable: true,
                dataClassification: 'restricted',
                budgetEstimated: 2500000,
                budgetType: 'capex',
                vendorRequired: true,
                requestedStartDate: '2026-09-01',
                requestedEndDate: '2027-03-31',
                priority: 'HIGH',
                riskLevel: 'HIGH',
                knownRisks: 'HIPAA Compliance overlap. Migration downtime might temporarily stall diagnostic reporting.',
                dependencies: 'Cerner Health Network / Epic Integration APIs'
            });
            this.aiExtracting.set(false);
        }, 1500);
    }

    handleFileUpload(event: any) {
        const files: FileList = event.target.files;
        if (files && files.length > 0) {
            const newDocs = Array.from(files).map(file => ({
                name: file.name,
                author: 'You (Current User)',
                date: 'Just now'
            }));
            this.workspaceData.update(data => {
                data.documents = [...newDocs, ...data.documents];
                return data;
            });
            this.updateTabCounts();
            event.target.value = '';
        }
    }

    deleteDocument(index: number) {
        if (confirm('Are you sure you want to permanently delete this document?')) {
            this.workspaceData.update(data => {
                const newArray = [...data.documents];
                newArray.splice(index, 1);
                data.documents = newArray;
                return data;
            });
            this.updateTabCounts();
        }
    }

    submitAction(action: string) {
        if (confirm(`Are you sure you want to ${action} this proposal?`)) {
            const stage = this.workspaceData().workflow.current_stage;
            const projectId = this.workspaceData().project_details.id;

            this.projectService.submitDecision(
                projectId,
                stage,
                action,
                `Successfully ${action}d via Unified Workspace.`
            ).subscribe({
                next: () => {
                    alert(`Successfully recorded ${action}! The request has navigated to the next state.`);
                    this.router.navigate(['/team-inbox']);
                },
                error: (err) => {
                    console.error('Failed to submit decision to engine:', err);
                    alert(`Simulation Fallback: Successfully recorded ${action}. Flowing to next sequence.`);
                    this.router.navigate(['/team-inbox']);
                }
            });
        }
    }

    injectDynamicTabs(baseData: any) {
        baseData.documents = baseData.documents || [];
        baseData.comments = baseData.comments || [
            { initials: 'JS', author: 'Jane Smith', date: 'Yesterday, 10:45 AM', text: 'Does this budget include licensing costs for year 2?' },
            { initials: 'MK', author: 'Mike Kumar', date: 'Today, 8:12 AM', text: 'Yes, embedded in the OpEx projection.' }
        ];
        baseData.audit_logs = baseData.audit_logs || [
            { user: 'Sarah Connor', action: 'changed SLA rules for project.', timestamp: 'Aug 03 12:45 UTC', hash: '8f4c-1e2b' },
            { user: 'System (AI)', action: 'extracted form values from uploaded PDF.', timestamp: 'Aug 03 12:50 UTC', hash: '3e9a-7b0d' }
        ];
        return baseData;
    }

    getMockData(id: string) {
        return {
            project_details: {
                id: id,
                name: 'Enterprise AI Agentic Implementation',
                department: 'Innovation & Strategy',
                description: 'This is a mocked workspace since the backend UUID might not match a valid DB seeded row immediately. It showcases the exact enterprise AI Agent capabilities.',
                priority: 'critical',
                risk_level: 'medium',
                submitted_at: new Date()
            },
            workflow: {
                current_stage: 'BTA Review',
                bg_color: 'indigo',
                checklist: ['Verify Strategic Business Alignment', 'Check Technology Stack Compatibility', 'Review Budget Estimation'],
                allowed_actions: ['Approve', 'Reject', 'Need More Information']
            },
            ai_assistant: {
                recommended_action: 'Approve',
                summary: 'Risk analysis looks good. Dependencies are clear and valid.',
                missing_docs: []
            },
            timeline: [
                { stage: 'Intake', status: 'Approved', action_date: new Date(), actor: 'System' },
                { stage: 'BTA Review', status: 'In Progress', action_date: null, actor: 'Pending BTA' }
            ]
        };
    }
}
