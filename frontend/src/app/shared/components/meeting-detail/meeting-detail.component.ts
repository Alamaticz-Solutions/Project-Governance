import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingService, SessionSynthesis } from '../../../core/services/meeting.service';
// @ts-ignore - bpmn-js ships without bundled types for the default export path
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';

export interface MeetingCard {
  id: number;
  type: string;
  title: string;
  date: string;
  time: string;
  actions: { id: number; text: string; assignee: string; done: boolean }[];
  agenda: { id: string; project: string; department: string }[];
  backendMeetingId?: string;
  summary?: string;
  decisions?: string[];
  containsProcessFlow?: boolean;
  processName?: string | null;
  bpmnXml?: string | null;
  bpmnStatus?: string | null;
  sessionSynthesis?: SessionSynthesis | null;
  sessionSynthesisMarkdown?: string | null;
  sessionSynthesisStatus?: string;
  projectId?: string | null;
  projectNumber?: string | null;
  projectName?: string | null;
}

const FINDING_TYPE_STYLES: Record<string, string> = {
  'Friction Point': 'bg-red-900/30 text-red-300 border-red-800/50',
  'Clarification Item': 'bg-amber-900/30 text-amber-300 border-amber-800/50',
  'Hypothesis': 'bg-purple-900/30 text-purple-300 border-purple-800/50',
  'Decision': 'bg-emerald-900/30 text-emerald-300 border-emerald-800/50',
  'Process Observation': 'bg-blue-900/30 text-blue-300 border-blue-800/50',
  'RAID': 'bg-slate-700/50 text-slate-300 border-slate-600/50',
};

@Component({
  selector: 'app-meeting-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-6">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- AI Meeting Summary -->
        <div class="bg-slate-800/50 backdrop-blur-md rounded-xl shadow-sm border border-slate-700 flex flex-col overflow-hidden h-[360px]">
          <div class="bg-indigo-900/40 px-5 py-4 flex items-center gap-2.5">
            <span class="material-icons text-indigo-300 text-[20px]">auto_awesome</span>
            <h3 class="font-bold text-white text-base">AI Summary & Notes</h3>
          </div>

          <div class="p-5 flex-1 overflow-y-auto custom-scrollbar">
            @if (meeting.summary) {
              <p class="text-sm text-slate-300 leading-relaxed mb-5">{{ meeting.summary }}</p>

              @if (meeting.decisions && meeting.decisions.length) {
                <div>
                  <div class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2.5 flex items-center gap-1.5">
                    <span class="material-icons text-[14px]">gavel</span> Key Decisions
                  </div>
                  <ul class="space-y-2">
                    @for (d of meeting.decisions; track d) {
                      <li class="flex items-start gap-2 text-sm text-slate-300 bg-slate-900/50 p-2.5 rounded-lg border border-slate-700">
                        <span class="material-icons text-emerald-400 text-[18px] shrink-0 mt-0.5">check_circle</span>
                        <span class="font-medium">{{ d }}</span>
                      </li>
                    }
                  </ul>
                </div>
              }
            } @else {
              <div class="flex flex-col items-center justify-center h-full text-center text-slate-500">
                <div class="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-3">
                  <span class="material-icons text-3xl text-slate-600">summarize</span>
                </div>
                <p class="text-sm font-medium text-slate-400">No summary generated yet</p>
                <p class="text-xs mt-1">Upload a recording or transcript to begin.</p>
              </div>
            }
          </div>
        </div>

        <!-- Action Items -->
        <div class="bg-slate-800/50 backdrop-blur-md rounded-xl shadow-sm border border-slate-700 flex flex-col h-[360px]">
          <div class="px-5 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/30">
            <div class="flex items-center gap-2.5">
              <span class="material-icons text-orange-400 text-[20px]">checklist</span>
              <h3 class="font-bold text-white text-base">Action Items</h3>
            </div>
            <span class="bg-orange-900/30 text-orange-300 text-xs font-bold px-2 py-0.5 rounded-md">{{ meeting.actions.length }}</span>
          </div>

          <div class="p-4 flex-1 overflow-y-auto custom-scrollbar">
            <div class="space-y-2.5">
              @for (action of meeting.actions; track action.id) {
                <div class="flex items-start gap-3 p-3 bg-slate-900/40 rounded-lg border border-slate-700">
                  <span class="material-icons text-slate-500 text-[16px] mt-0.5">radio_button_unchecked</span>
                  <div class="flex-1">
                    <p class="text-sm font-semibold text-slate-200">{{ action.text }}</p>
                    <div class="flex items-center gap-1.5 mt-1.5">
                      <div class="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-400 uppercase">{{ action.assignee.substring(0, 2) }}</div>
                      <p class="text-[11px] text-slate-500 font-medium">{{ action.assignee }}</p>
                    </div>
                  </div>
                </div>
              }
              @if (!meeting.actions.length) {
                <div class="flex flex-col items-center justify-center h-full text-center text-slate-500 py-12">
                  <div class="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-3">
                    <span class="material-icons text-3xl text-slate-600">task</span>
                  </div>
                  <p class="text-sm font-medium text-slate-400">No action items extracted</p>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Session Synthesis -->
      <div class="bg-slate-800/50 backdrop-blur-md rounded-xl shadow-sm border border-slate-700 overflow-hidden">
        <div class="bg-slate-900/40 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="material-icons text-teal-400 text-[20px]">fact_check</span>
            <h3 class="font-bold text-white text-base">Session Synthesis</h3>
          </div>
          <div class="flex items-center gap-2">
            @if (meeting.sessionSynthesis) {
              @if (meeting.sessionSynthesisStatus === 'approved') {
                <span class="bg-emerald-900/30 text-emerald-300 border border-emerald-800/50 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1">
                  <span class="material-icons text-[14px]">check_circle</span> Approved
                </span>
              } @else {
                <button (click)="approveSynthesis()" [disabled]="isApproving" class="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1">
                  <span class="material-icons text-[14px]">task_alt</span> Approve for Quote Index & Tracker
                </button>
              }
            }
            @if (meeting.sessionSynthesisMarkdown) {
              <button (click)="downloadSessionSynthesis()" class="bg-slate-800 border border-slate-700 text-slate-300 hover:border-teal-600 hover:text-teal-400 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1">
                <span class="material-icons text-[14px]">download</span> Download .md
              </button>
            }
          </div>
        </div>

        <div class="p-5">
          @if (meeting.sessionSynthesis; as synthesis) {
            <p class="text-sm text-slate-300 leading-relaxed mb-4">{{ synthesis.session_purpose }}</p>

            @if (synthesis.participants.length) {
              <div class="flex flex-wrap gap-1.5 mb-4">
                @for (p of synthesis.participants; track p) {
                  <span class="text-[11px] font-bold bg-slate-900/50 text-slate-300 px-2 py-1 rounded-md border border-slate-700">{{ p }}</span>
                }
              </div>
            }

            @if (synthesis.findings.length) {
              <div class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2.5 flex items-center gap-1.5">
                <span class="material-icons text-[14px]">fact_check</span> Findings ({{ synthesis.findings.length }})
              </div>
              <ul class="space-y-2 mb-4">
                @for (f of synthesis.findings; track $index) {
                  <li class="flex items-start gap-2.5 text-sm bg-slate-900/50 p-2.5 rounded-lg border border-slate-700">
                    <span class="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded border shrink-0 mt-0.5" [ngClass]="findingTypeClass(f.finding_type)">{{ f.finding_type }}</span>
                    <span class="flex-1 text-slate-300">{{ f.description }}
                      <span class="text-slate-500"> — {{ f.speaker }}</span>
                    </span>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-sm text-slate-500 mb-4">No typed findings identified in this session.</p>
            }

            @if (synthesis.analyst_notes.methodological_flags) {
              <div class="text-xs text-amber-400 bg-amber-900/10 border border-amber-900/30 rounded-lg p-3 flex items-start gap-2">
                <span class="material-icons text-[16px] shrink-0">info</span>
                <span>{{ synthesis.analyst_notes.methodological_flags }}</span>
              </div>
            }
          } @else {
            <div class="flex flex-col items-center justify-center text-center text-slate-500 py-10">
              <div class="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-3">
                <span class="material-icons text-3xl text-slate-600">fact_check</span>
              </div>
              <p class="text-sm font-medium text-slate-400">No session synthesis generated yet</p>
              <p class="text-xs mt-1">Upload a recording or transcript to begin.</p>
            </div>
          }
        </div>
      </div>

      <!-- Process Diagram (BPMN) -->
      @if (meeting.containsProcessFlow) {
        <div class="bg-slate-800/50 backdrop-blur-md rounded-xl shadow-sm border border-slate-700 overflow-hidden">
          <div class="bg-slate-900/40 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="material-icons text-emerald-400 text-[20px]">account_tree</span>
              <div>
                <h3 class="font-bold text-white text-base">Process Diagram{{ meeting.processName ? ': ' + meeting.processName : '' }}</h3>
              </div>
            </div>
            @if (meeting.bpmnXml) {
              <div class="flex items-center gap-2">
                @if (meeting.bpmnStatus === 'generated') {
                  <button (click)="downloadBpmnPng()" class="bg-slate-800 border border-slate-700 text-slate-300 hover:border-emerald-600 hover:text-emerald-400 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1">
                    <span class="material-icons text-[14px]">image</span> Download PNG
                  </button>
                }
                <button (click)="downloadBpmn()" class="bg-slate-800 border border-slate-700 text-slate-300 hover:border-emerald-600 hover:text-emerald-400 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1">
                  <span class="material-icons text-[14px]">download</span> Download XML
                </button>
              </div>
            }
          </div>

          <div class="relative bg-slate-950/30 border-t border-slate-700">
            @if (meeting.bpmnStatus === 'generated' && meeting.bpmnXml) {
              <div #bpmnContainer class="bpmn-container h-[400px] w-full"></div>
            } @else if (meeting.bpmnStatus === 'failed') {
              <div class="p-10 flex flex-col items-center justify-center text-red-400">
                <span class="material-icons text-4xl mb-2">error_outline</span>
                <p class="text-sm font-bold">BPMN generation failed</p>
              </div>
            } @else {
              <div class="p-10 flex flex-col items-center justify-center text-slate-500 h-[300px]">
                <span class="material-icons text-3xl animate-spin mb-3 text-emerald-500">sync</span>
                <p class="text-sm font-bold text-slate-300">Generating process diagram...</p>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .bpmn-container {
      width: 100%;
      height: 400px;
      cursor: grab;
      position: relative;
      overflow: hidden;
    }
    .bpmn-container:active {
      cursor: grabbing;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 6px;
    }
  `]
})
export class MeetingDetailComponent implements AfterViewChecked, OnDestroy {
  @Input({ required: true }) meeting!: MeetingCard;
  @Output() synthesisApproved = new EventEmitter<void>();

  @ViewChild('bpmnContainer') bpmnContainerRef?: ElementRef<HTMLDivElement>;
  private bpmnViewer: any = null;
  private renderedBpmnXml: string | null = null;

  isApproving = false;

  private meetingService = inject(MeetingService);

  findingTypeClass(findingType: string): string {
    return FINDING_TYPE_STYLES[findingType] || 'bg-slate-700/50 text-slate-300 border-slate-600/50';
  }

  approveSynthesis(): void {
    if (!this.meeting.backendMeetingId) return;
    this.isApproving = true;
    this.meetingService.approveSynthesis(this.meeting.backendMeetingId).subscribe({
      next: (result) => {
        this.meeting.sessionSynthesisStatus = result.session_synthesis_status;
        this.isApproving = false;
        this.synthesisApproved.emit();
      },
      error: (err) => {
        console.error('Failed to approve synthesis:', err);
        this.isApproving = false;
      }
    });
  }

  downloadSessionSynthesis(): void {
    if (!this.meeting.sessionSynthesisMarkdown) return;
    const blob = new Blob([this.meeting.sessionSynthesisMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.meeting.title.replace(/\s+/g, '_')}_Session_Synthesis.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  downloadBpmn(): void {
    if (!this.meeting.bpmnXml) return;
    const blob = new Blob([this.meeting.bpmnXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(this.meeting.processName || this.meeting.title).replace(/\s+/g, '_')}.bpmn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async downloadBpmnPng(): Promise<void> {
    if (!this.bpmnViewer) return;
    try {
      const { svg } = await this.bpmnViewer.saveSVG();
      const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));

      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;

        const ctx = canvas.getContext('2d');
        URL.revokeObjectURL(svgUrl);
        if (!ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) return;
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${(this.meeting.processName || this.meeting.title).replace(/\s+/g, '_')}.png`;
          a.click();
          URL.revokeObjectURL(pngUrl);
        }, 'image/png');
      };
      img.onerror = (err) => {
        console.error('Failed to rasterize BPMN SVG for PNG export:', err);
        URL.revokeObjectURL(svgUrl);
      };
      img.src = svgUrl;
    } catch (err) {
      console.error('Failed to export BPMN diagram as PNG:', err);
    }
  }

  ngAfterViewChecked(): void {
    const meeting = this.meeting;
    if (!meeting || meeting.bpmnStatus !== 'generated' || !meeting.bpmnXml || !this.bpmnContainerRef) return;
    if (this.renderedBpmnXml === meeting.bpmnXml) return;

    if (!this.bpmnViewer) {
      this.bpmnViewer = new BpmnViewer({ container: this.bpmnContainerRef.nativeElement });
    }
    const xml = meeting.bpmnXml;
    this.bpmnViewer.importXML(xml).then(() => {
      // Marked done as soon as import succeeds, before the zoom attempt below — otherwise
      // a zoom failure (e.g. the container has zero size on the first paint of a card that
      // was just expanded) leaves this unset, and ngAfterViewChecked re-runs importXML on
      // every change-detection tick forever instead of just skipping the cosmetic fit.
      this.renderedBpmnXml = xml;
      try {
        this.bpmnViewer.get('canvas').zoom('fit-viewport');
      } catch (zoomErr) {
        // Usually means the container was still zero-size on this tick (e.g. right as an
        // expand animation starts). One retry after layout settles is enough — this isn't
        // wrapped in the ngAfterViewChecked retry loop since renderedBpmnXml is already set.
        setTimeout(() => {
          try { this.bpmnViewer?.get('canvas').zoom('fit-viewport'); } catch { /* give up quietly */ }
        }, 150);
      }
    }).catch((err: any) => console.error('Failed to render BPMN diagram:', err));
  }

  ngOnDestroy(): void {
    this.bpmnViewer?.destroy();
  }
}
