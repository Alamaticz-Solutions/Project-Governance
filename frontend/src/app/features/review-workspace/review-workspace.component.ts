import { Component, signal, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { BtaReviewComponent } from '../bta-review/bta-review.component';
import { PrepareEacComponent } from '../eac-review/prepare-eac.component';
import { PreparePicComponent } from '../pic-review/prepare-pic.component';
import { PicMeetingComponent } from '../pic-review/pic-meeting.component';
import { EpmoReviewComponent } from '../epmo-review/epmo-review.component';
import { FinanceReviewComponent } from '../finance-review/finance-review.component';
import { ProjectService } from '../../core/services/project.service';
import { ConfirmationScreenComponent } from '../../shared/components/confirmation-screen/confirmation-screen.component';

@Component({
    selector: 'app-review-workspace',
    standalone: true,
    imports: [CommonModule, BtaReviewComponent, PrepareEacComponent, PreparePicComponent, PicMeetingComponent, EpmoReviewComponent, FinanceReviewComponent, ConfirmationScreenComponent],
    template: `
    <div class="animate-fade-in min-h-[calc(100vh-64px)] flex gap-6 font-sans p-8 bg-[#0f172a] text-slate-100 relative overflow-hidden">
      
      <!-- Deep Gradient Background -->
      <div class="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] z-0 pointer-events-none"></div>
      <div class="absolute top-0 left-0 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-3xl mix-blend-screen pointer-events-none transform -translate-x-1/2 -translate-y-1/2"></div>
      <div class="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl mix-blend-screen pointer-events-none transform translate-x-1/3 translate-y-1/3"></div>

      @if (completedAction(); as action) {
        <div class="flex flex-1 items-center justify-center relative z-10 w-full">
          <app-confirmation-screen
            [title]="action.title"
            [message]="action.message"
            returnLabel="Return to Pending Reviews"
            returnRoute="/team-inbox">
          </app-confirmation-screen>
        </div>
      } @else if (loading()) {
        <div class="flex flex-1 items-center justify-center relative z-10">
          <div class="flex flex-col items-center gap-4">
            <div class="w-14 h-14 rounded-full flex items-center justify-center bg-slate-800/80 shadow-[0_0_20px_rgba(99,102,241,0.2)] border border-white/10 backdrop-blur-md">
              <span class="material-icons text-indigo-400 text-2xl animate-spin">autorenew</span>
            </div>
            <p class="text-sm font-semibold text-slate-400">Loading workspace...</p>
          </div>
        </div>
      } @else {

        <!-- ══ Main Workspace (Left Column) ══ -->
        <div class="flex-1 flex flex-col gap-6 min-w-0 relative z-10">

          <!-- ── Premium Header Card ── -->
          <div class="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-6 relative overflow-hidden transition-all duration-300 hover:shadow-[0_8px_32px_rgba(99,102,241,0.15)] group">
            <!-- Inner subtle glow -->
            <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>
            <!-- Decorative Accent Line -->
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-80"></div>

            <div class="flex flex-wrap justify-between items-start gap-4 mt-2">
              <div class="flex-1 min-w-[260px]">
                <!-- Stage breadcrumb -->
                <div class="flex flex-wrap items-center gap-3 mb-4">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 backdrop-blur-sm">
                    <span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]"></span>
                    {{ workspaceData().workflow.current_stage }}
                  </span>
                  <span class="text-slate-600">/</span>
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">ASSIGNED TO: UNASSIGNED</span>
                </div>

                <!-- Project title -->
                <h1 class="text-3xl font-extrabold text-white mb-5 tracking-tight drop-shadow-md break-words">
                  {{ workspaceData().project_details.name }}
                </h1>

                <!-- Meta chips -->
                <div class="flex flex-wrap items-center gap-6">
                  <div class="flex items-center gap-2 text-[13px] font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">
                    <span class="material-icons text-[16px] text-slate-500 group-hover:text-indigo-400 transition-colors">tag</span>
                    REQ-2025-000123
                  </div>
                  <div class="flex items-center gap-2 text-[13px] font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">
                    <span class="material-icons text-[16px] text-slate-500 group-hover:text-indigo-400 transition-colors">person_outline</span>
                    <span class="text-slate-200">{{ workspaceData().project_details.requestorName || 'Gurrammaneesh User' }}</span>
                  </div>
                  <div class="flex items-center gap-2 text-[13px] font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">
                    <span class="material-icons text-[16px] text-slate-500 group-hover:text-indigo-400 transition-colors">calendar_today</span>
                    {{ workspaceData().project_details.submitted_at | date:'MMM dd, yyyy' }}
                  </div>
                </div>
              </div>

              <!-- Action / Status Button (right) -->
              <div class="flex flex-col items-end shrink-0">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Current Stage</span>
                <div class="px-4 py-2 bg-slate-800/60 border border-white/10 rounded-lg flex items-center gap-2 shadow-inner backdrop-blur-sm group-hover:border-indigo-500/30 transition-colors whitespace-nowrap">
                  <span class="material-icons text-[18px] text-indigo-400">flag</span>
                  <span class="text-[14px] font-bold text-slate-200">{{ workspaceData().workflow.current_stage }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── Premium Tab Navigation ── -->
          <div class="flex items-center gap-2 mb-2 border-b border-white/10 pb-0 overflow-x-auto">
            @for (tab of tabs; track tab.key) {
              <button class="flex items-center gap-2 px-6 py-3.5 text-[14px] font-bold border-b-[3px] transition-all duration-300 -mb-[1px] rounded-t-lg shrink-0"
                      [ngClass]="activeTab() === tab.key ? 'text-indigo-400 border-indigo-500 bg-indigo-500/10' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'"
                      (click)="activeTab.set(tab.key)">
                <span class="material-icons text-[18px]" [ngClass]="activeTab() === tab.key ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''">{{ tab.icon }}</span>
                {{ tab.label }}
                @if (tab.count !== undefined) {
                  <span class="ml-1.5 text-[11px] font-extrabold px-2 py-0.5 rounded-full transition-colors"
                        [ngClass]="activeTab() === tab.key ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-slate-800 text-slate-400 border border-white/5'">{{ tab.count }}</span>
                }
              </button>
            }
          </div>

          <!-- ── Form Engine Container ── -->
          <div [style.display]="(activeTab() === 'Form Engine' || activeTab() === 'Overview') ? 'block' : 'none'"
               class="animate-fade-in w-full drop-shadow-xl">
            @if(workspaceData().workflow.current_stage.includes('BTA')) {
              <app-bta-review [embeddedMode]="true"
                              [projectId]="workspaceData().project_details.id"
                              [isExtracting]="aiExtracting()"
                              [availableDocuments]="workspaceData().documents.length"
                              [autoPopulatedData]="btaFormValues()"
                              (triggerAiExtraction)="simulateAiExtraction()">
              </app-bta-review>
            }
            @if(workspaceData().workflow.current_stage.includes('Finance')) {
              <app-finance-review [embeddedMode]="true" [projectId]="workspaceData().project_details.id"></app-finance-review>
            }
            @if(workspaceData().workflow.current_stage.includes('EPMO') || workspaceData().workflow.current_stage.includes('Parallel')) {
              <app-epmo-review [embeddedMode]="true"></app-epmo-review>
            }
            @if(workspaceData().workflow.current_stage.includes('EAC')) {
              <app-prepare-eac [embeddedMode]="true" [incomingProjectId]="workspaceData().project_details.id"></app-prepare-eac>
            }
            @if(workspaceData().workflow.current_stage === 'Prepare for PIC') {
              <app-prepare-pic [embeddedMode]="true"
                                [projectId]="workspaceData().project_details.id"
                                [projectData]="workspaceData().project_details"
                                (formSubmitted)="completedAction.set($event)">
              </app-prepare-pic>
            }
            @if(workspaceData().workflow.current_stage === 'PIC Meeting') {
              <app-pic-meeting [embeddedMode]="true"
                                [projectId]="workspaceData().project_details.id"
                                [projectData]="workspaceData().project_details"
                                (formSubmitted)="completedAction.set($event)">
              </app-pic-meeting>
            }
          </div>

          <!-- ── Other Tab Content ── -->
          <div *ngIf="activeTab() !== 'Form Engine' && activeTab() !== 'Overview'"
               class="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8 min-h-[400px] relative">
            
            <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>

            <!-- DOCUMENTS TAB -->
            <div *ngIf="activeTab() === 'Documents'" class="animate-fade-in space-y-3 relative z-10">
              <div class="flex justify-between items-center mb-6">
                <div>
                  <h3 class="text-lg font-bold text-white drop-shadow-md">Project Documents</h3>
                  <p class="text-[12px] mt-0.5 text-slate-400">{{ workspaceData().documents.length }} files attached</p>
                </div>
                <input type="file" #fileUpload class="hidden" multiple (change)="handleFileUpload($event)">
                <button (click)="fileUpload.click()"
                        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)] hover:shadow-[0_8px_24px_rgba(99,102,241,0.5)] hover:-translate-y-[1px] border border-indigo-500/50">
                  <span class="material-icons text-[18px]">cloud_upload</span>
                  Upload File
                </button>
              </div>

              @if (workspaceData().documents.length === 0) {
                <div class="flex flex-col items-center justify-center py-16 text-center bg-slate-900/30 rounded-xl border border-dashed border-white/10">
                  <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-indigo-500/10 border border-indigo-500/20 shadow-inner">
                    <span class="material-icons text-3xl text-indigo-400">folder_open</span>
                  </div>
                  <p class="font-semibold text-sm text-slate-300">No documents uploaded yet</p>
                  <p class="text-xs mt-1 text-slate-400">Upload documents to attach them to this review</p>
                </div>
              }

              <div *ngFor="let doc of workspaceData().documents; let i = index"
                   class="flex justify-between items-center p-4 rounded-xl transition-all duration-300 group bg-slate-800/40 border border-white/5 hover:bg-slate-800/70 hover:border-indigo-500/30">
                <div class="flex items-center gap-4">
                  <div class="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                    <span class="material-icons text-[22px] text-amber-400">picture_as_pdf</span>
                  </div>
                  <div>
                    <p class="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{{ doc.name }}</p>
                    <p class="text-[11px] font-medium mt-0.5 text-slate-400">Uploaded by {{ doc.author }} · {{ doc.date }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button class="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-300">
                    <span class="material-icons text-[18px]">download</span>
                  </button>
                  <button class="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
                          (click)="deleteDocument(i)">
                    <span class="material-icons text-[18px]">delete_outline</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- COMMENTS TAB -->
            <div *ngIf="activeTab() === 'Comments'" class="animate-fade-in flex flex-col h-full space-y-5 relative z-10">
              <div>
                <h3 class="text-lg font-bold text-white drop-shadow-md">Discussion Thread</h3>
                <p class="text-[12px] mt-0.5 text-slate-400">{{ workspaceData().comments.length }} messages in this review</p>
              </div>
              <div class="flex-1 overflow-y-auto space-y-5">
                <div *ngFor="let comment of workspaceData().comments" class="flex gap-4">
                  <!-- Avatar -->
                  <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_2px_8px_rgba(99,102,241,0.4)] border border-indigo-400/30">
                    {{ comment.initials }}
                  </div>
                  <div class="flex-1">
                    <div class="flex items-center justify-between mb-1.5">
                      <p class="text-[13px] font-bold text-slate-200">{{ comment.author }}</p>
                      <span class="text-[11px] font-medium text-slate-400">{{ comment.date }}</span>
                    </div>
                    <p class="text-[13px] leading-relaxed p-4 rounded-2xl rounded-tl-sm text-slate-300 bg-slate-800/60 border border-white/5 backdrop-blur-sm shadow-inner">{{ comment.text }}</p>
                  </div>
                </div>
              </div>
              <!-- Comment input -->
              <div class="flex gap-3 pt-4 border-t border-white/10">
                <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-slate-300 bg-slate-800 border border-white/10 shadow-inner">ME</div>
                <input type="text" placeholder="Add a comment... (Press Enter to post)"
                       class="flex-1 px-4 py-2.5 rounded-xl text-[13px] outline-none transition-all duration-300 bg-slate-900/60 border border-white/10 text-slate-200 placeholder-slate-500 focus:bg-slate-800 focus:border-indigo-500/50 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.15)]">
                <button class="px-5 rounded-xl font-bold text-[13px] text-white transition-all duration-300 bg-gradient-to-r from-indigo-600 to-purple-600 shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.5)] hover:-translate-y-[1px] border border-indigo-500/50">Post</button>
              </div>
            </div>

            <!-- AUDIT TRAIL TAB -->
            <div *ngIf="activeTab() === 'Audit'" class="animate-fade-in relative z-10">
              <div class="mb-6">
                <h3 class="text-lg font-bold text-white drop-shadow-md">Action History</h3>
                <p class="text-[12px] mt-0.5 text-slate-400">Immutable audit trail — tamper-evident blockchain hashes</p>
              </div>
              <div class="relative ml-2">
                <!-- gradient connecting line -->
                <div class="absolute left-[11px] top-4 bottom-4 w-[2px] rounded-full bg-gradient-to-b from-indigo-500 via-purple-500 to-transparent opacity-50"></div>
                <div *ngFor="let log of workspaceData().audit_logs" class="relative flex gap-5 mb-6 z-10">
                  <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 bg-slate-900 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]">
                    <div class="w-2 h-2 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 shadow-[0_0_5px_rgba(167,139,250,0.8)]"></div>
                  </div>
                  <div class="flex-1 p-4 rounded-xl bg-slate-800/40 border border-white/5 backdrop-blur-sm transition-colors hover:bg-slate-800/70 hover:border-indigo-500/30">
                    <p class="text-[13px] text-slate-300"><span class="font-bold text-white">{{ log.user }}</span> {{ log.action }}</p>
                    <div class="flex items-center gap-3 mt-1.5">
                      <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{{ log.timestamp }}</p>
                      <span class="text-[11px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">{{ log.hash }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- ══ Action Widgets Row (AI Recommendation / Required Decision / Approval Timeline) ══ -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">

          <!-- AI Recommendation Panel -->
          <div class="rounded-2xl p-6 relative overflow-hidden bg-white/5 backdrop-blur-md border border-indigo-500/30 shadow-[0_8px_32px_rgba(0,0,0,0.4)] group">
            <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>
            <!-- Ambient glow circles -->
            <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none bg-[radial-gradient(circle,rgba(167,139,250,0.15)_0%,transparent_70%)] group-hover:bg-[radial-gradient(circle,rgba(167,139,250,0.25)_0%,transparent_70%)] transition-colors duration-500"></div>
            <div class="absolute -bottom-6 -left-6 w-24 h-24 rounded-full pointer-events-none bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_70%)] group-hover:bg-[radial-gradient(circle,rgba(99,102,241,0.25)_0%,transparent_70%)] transition-colors duration-500"></div>

            <div class="relative z-10">
              <div class="flex items-center gap-2.5 mb-5">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/20 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                  <span class="material-icons text-[18px] text-purple-300">auto_awesome</span>
                </div>
                <h3 class="text-[14px] font-extrabold text-white drop-shadow-md">AI Recommendation</h3>
              </div>

              <!-- Confidence bar -->
              <div class="mb-5">
                <div class="flex justify-between items-center mb-2">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Confidence Score</span>
                  <span class="text-[13px] font-extrabold bg-gradient-to-r from-indigo-300 to-purple-300 -webkit-background-clip-text text-transparent drop-shadow-sm">87%</span>
                </div>
                <div class="h-2 rounded-full overflow-hidden bg-slate-800 border border-white/5 shadow-inner">
                  <div class="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" style="width: 87%;"></div>
                </div>
              </div>

              <!-- Recommendation chip -->
              <div class="flex items-center gap-2.5 p-3 rounded-xl mb-4 bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                <span class="material-icons text-[18px] text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">check_circle</span>
                <span class="font-bold text-sm text-emerald-300">{{ workspaceData().ai_assistant.recommended_action || 'Approve' }}</span>
              </div>

              <p class="text-[12px] leading-relaxed mb-4 text-slate-300">
                This project aligns well with organizational goals and has strong business justification.
              </p>

              <a href="#" class="flex items-center gap-1.5 text-[12px] font-bold transition-colors text-indigo-400 hover:text-indigo-300 hover:drop-shadow-[0_0_5px_rgba(129,140,248,0.5)]">
                View Full Analysis
                <span class="material-icons text-[14px]">arrow_forward</span>
              </a>
            </div>
          </div>

          <!-- Required Decision Panel -->
          <div class="rounded-2xl p-6 bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
            <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>

            <div class="flex items-center gap-2 mb-5 relative z-10">
              <div class="w-2 h-2 rounded-full animate-pulse bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
              <h3 class="text-[14px] font-extrabold text-white drop-shadow-md">Required Decision</h3>
              <span class="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 backdrop-blur-sm">
                {{ workspaceData().workflow.current_stage }}
              </span>
            </div>

            <div class="flex flex-col gap-3 relative z-10">
              <!-- Approve -->
              <button (click)="submitAction('Approve')"
                      class="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 font-bold text-[13px] text-white transition-all duration-300 bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_24px_rgba(16,185,129,0.45)] hover:-translate-y-[1px] border border-emerald-400/50">
                <span class="material-icons text-[18px]">check_circle_outline</span>
                Approve
              </button>

              <!-- Reject -->
              <button (click)="submitAction('Reject')"
                      class="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 font-bold text-[13px] text-white transition-all duration-300 bg-gradient-to-r from-rose-600 to-rose-500 shadow-[0_4px_16px_rgba(225,29,72,0.3)] hover:shadow-[0_8px_24px_rgba(225,29,72,0.45)] hover:-translate-y-[1px] border border-rose-400/50">
                <span class="material-icons text-[18px]">highlight_off</span>
                Reject
              </button>

              <!-- Need More Information -->
              <button (click)="submitAction('Need More Information')"
                      class="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 font-bold text-[13px] transition-all duration-300 bg-slate-800/60 text-slate-300 border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.2)] hover:bg-slate-700/80 hover:text-white hover:border-indigo-500/50 hover:shadow-[0_4px_12px_rgba(99,102,241,0.2)]">
                <span class="material-icons text-[18px]">help_outline</span>
                Need More Information
              </button>
            </div>
          </div>

          <!-- Approval Timeline Panel -->
          <div class="rounded-2xl p-6 flex-1 bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
            <div class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>

            <h3 class="text-[14px] font-extrabold mb-6 text-white drop-shadow-md relative z-10">Approval Timeline</h3>

            <div class="relative ml-2 mt-2 z-10">
              <!-- Gradient connecting line -->
              <div class="absolute top-[8px] bottom-0 left-[7px] w-[2px] rounded-full bg-gradient-to-b from-indigo-500 via-indigo-500/50 to-transparent"></div>

              @for (node of workspaceData().timeline; track node.stage; let i = $index) {
                <div class="relative flex items-start gap-4 mb-5 z-10">
                  <!-- Status dot -->
                  <div class="w-4 h-4 rounded-full shrink-0 mt-0.5 flex items-center justify-center relative"
                       [style]="node.status === 'Approved'
                         ? 'background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 0 0 3px rgba(16,185,129,0.15), 0 2px 8px rgba(16,185,129,0.3); border: none;'
                         : node.status === 'In Progress'
                         ? 'background: linear-gradient(135deg, #6366f1, #4f46e5); box-shadow: 0 0 0 4px rgba(99,102,241,0.15), 0 2px 8px rgba(99,102,241,0.35); border: none;'
                         : 'background: #1e293b; border: 2px solid #334155;'">
                    @if (node.status === 'Approved') {
                      <span class="material-icons text-white" style="font-size: 10px; line-height: 1;">check</span>
                    }
                    @if (node.status === 'In Progress') {
                      <div class="w-2 h-2 rounded-full animate-pulse bg-white/90 shadow-[0_0_5px_rgba(255,255,255,0.8)]"></div>
                    }
                  </div>
                  <div class="flex-1 -mt-0.5">
                    <p class="text-[13px] font-bold transition-colors"
                       [style]="node.status === 'In Progress' ? 'color: #f8fafc; text-shadow: 0 0 10px rgba(255,255,255,0.2);' : (node.status === 'Approved' ? 'color: #cbd5e1;' : 'color: #64748b;')">
                      {{ node.stage }}
                    </p>
                    <p class="text-[11px] font-semibold mt-0.5 transition-colors"
                       [style]="node.status === 'Approved' ? 'color: #34d399;' : node.status === 'In Progress' ? 'color: #818cf8;' : 'color: #475569;'">
                      {{ node.status }}<span *ngIf="node.actor"> — {{ node.actor }}</span>
                    </p>
                    @if (node.action_date) {
                      <p class="text-[11px] font-medium mt-0.5 text-slate-500">{{ node.action_date | date:'MMM dd, yyyy — hh:mm a' }}</p>
                    }
                  </div>
                </div>
              }

              <!-- Static future nodes -->
              <div class="relative flex items-start gap-4 mb-5 z-10">
                <div class="w-4 h-4 rounded-full shrink-0 mt-0.5 bg-slate-900 border-2 border-slate-700"></div>
                <div class="flex-1 -mt-0.5">
                  <p class="text-[13px] font-bold text-slate-500">EAC Review</p>
                  <p class="text-[11px] font-semibold mt-0.5 text-slate-600">Pending</p>
                </div>
              </div>
              <div class="relative flex items-start gap-4 z-10">
                <div class="w-4 h-4 rounded-full shrink-0 mt-0.5 bg-slate-900 border-2 border-slate-700"></div>
                <div class="flex-1 -mt-0.5">
                  <p class="text-[13px] font-bold text-slate-500">Completed</p>
                  <p class="text-[11px] font-semibold mt-0.5 text-slate-600">Pending</p>
                </div>
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
    completedAction = signal<{ title: string; message: string } | null>(null);

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
                                submitted_at: project.submitted_at,
                                requestorName: project.requestor_name,
                                // Aliases expected by the PIC prep/meeting screens
                                dept: project.department,
                                number: project.project_number,
                                due: project.submitted_at ? new Date(project.submitted_at).toLocaleDateString() : '',
                                problemStatement: project.problem_statement,
                                scope: (project.ai_extracted_data && project.ai_extracted_data.scope) || '',
                                budget: project.budget_estimated ? `$${project.budget_estimated.toLocaleString()}` : '$0.00',
                                picVendorName: project.ai_extracted_data?.pic_vendor_name || '',
                                picVendorJustification: project.ai_extracted_data?.pic_vendor_justification || '',
                                picIrr: project.ai_extracted_data?.pic_irr || '',
                                picCapex: project.ai_extracted_data?.pic_capex || '',
                                picPaybackMonths: project.ai_extracted_data?.pic_payback_months || '',
                                picBenefitMethodology: project.ai_extracted_data?.pic_benefit_methodology || ''
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
                    this.completedAction.set({
                        title: `Successfully ${action}d`,
                        message: `The request has been recorded and moved to the next stage of the workflow.`
                    });
                },
                error: (err) => {
                    console.error('Failed to submit decision to engine:', err);
                    this.completedAction.set({
                        title: `Successfully ${action}d`,
                        message: `The request has been recorded and moved to the next stage of the workflow.`
                    });
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
