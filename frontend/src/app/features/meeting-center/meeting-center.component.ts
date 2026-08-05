import { Component, signal, AfterViewChecked, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { MeetingService, ActionItem, AgendaItem } from '../../core/services/meeting.service';
// @ts-ignore - bpmn-js ships without bundled types for the default export path
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';

interface MeetingCard {
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
}

@Component({
  selector: 'app-meeting-center',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fade-in p-6 bg-enterprise-bg min-h-full">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="font-display text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <span class="material-icons text-enterprise-primary text-[32px]">groups</span>
            Enterprise Meeting Center
          </h1>
          <p class="text-sm font-medium text-gray-500 mt-1">Manage governance council meetings and AI-driven agenda tracking.</p>
        </div>
        <button class="bg-enterprise-primary hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5">
          <span class="material-icons text-[18px]">add</span> Schedule Meeting
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Upcoming Schedule Sidebar -->
        <div class="space-y-6">
          <div class="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100 p-5">
            <h3 class="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2 mb-4">Upcoming Schedule</h3>

            <div class="space-y-3">
              @for (meeting of upcomingMeetings; track meeting.id) {
                <div (click)="selectMeeting(meeting)"
                     class="p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md"
                     [ngClass]="activeMeeting()?.id === meeting.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100 hover:border-indigo-100'">
                  <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded"
                          [ngClass]="meeting.type === 'EAC' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'">{{ meeting.type }} COUNCIL</span>
                    <span class="text-[11px] font-bold text-gray-400">{{ meeting.time }}</span>
                  </div>
                  <h4 class="font-bold text-gray-800 text-sm mb-1 leading-snug">{{ meeting.title }}</h4>
                  <p class="text-xs text-gray-500">{{ meeting.date }}</p>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Meeting Workspace -->
        @if (activeMeeting(); as meeting) {
          <div class="lg:col-span-2 flex flex-col gap-6">

            <!-- Context Header -->
            <div class="bg-white rounded-2xl p-6 shadow-enterprise-soft border border-gray-100 flex flex-col gap-4">
              <div class="flex justify-between items-start">
                <div>
                  <h2 class="font-display text-2xl font-bold text-gray-900 mb-1">{{ meeting.title }}</h2>
                  <div class="flex gap-4 text-xs font-medium text-gray-500">
                    <span class="flex items-center gap-1"><span class="material-icons text-[14px]">event</span> {{ meeting.date }}</span>
                    <span class="flex items-center gap-1"><span class="material-icons text-[14px]">schedule</span> {{ meeting.time }}</span>
                    <span class="flex items-center gap-1"><span class="material-icons text-[14px]">videocam</span> MSTeams Bridge</span>
                  </div>
                </div>
                <div class="flex gap-2">
                  <div class="flex -space-x-2">
                    <div class="w-8 h-8 rounded-full border-2 border-white bg-blue-500 text-white flex items-center justify-center text-xs font-bold">AK</div>
                    <div class="w-8 h-8 rounded-full border-2 border-white bg-orange-500 text-white flex items-center justify-center text-xs font-bold">JR</div>
                    <div class="w-8 h-8 rounded-full border-2 border-white bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold">+5</div>
                  </div>
                  <button class="bg-gray-100 hover:bg-gray-200 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                    <span class="material-icons text-[16px]">person_add</span>
                  </button>
                </div>
              </div>

              <!-- Upload zone -->
              <div class="upload-zone" (click)="fileInput.click()">
                <span class="material-icons upload-icon">cloud_upload</span>
                <div class="upload-info">
                  <div class="font-semibold text-sm text-primary">Upload Meeting Recording / Transcript</div>
                  <div class="text-xs text-muted">AI will transcribe (if needed) and extract summary, decisions, action items & agenda · Video, .vtt, .txt</div>
                  @if (isProcessing()) {
                    <div class="text-xs text-indigo-600 font-bold mt-1 flex items-center gap-1">
                      <span class="material-icons text-sm animate-spin">sync</span> AI is processing the meeting artifact...
                    </div>
                  }
                  @if (uploadedFileName() && !isProcessing()) {
                    <div class="text-xs text-green-700 font-bold mt-1 flex items-center gap-1">
                      <span class="material-icons text-sm">attach_file</span> Processed: {{ uploadedFileName() }}
                    </div>
                  }
                  @if (uploadError()) {
                    <div class="text-xs text-red-600 font-bold mt-1 flex items-center gap-1">
                      <span class="material-icons text-sm">error</span> {{ uploadError() }}
                    </div>
                  }
                </div>
                <button type="button" class="btn btn-secondary btn-sm" (click)="$event.stopPropagation(); fileInput.click()">
                  <span class="material-icons text-sm">folder_open</span> Browse Files
                </button>
                <input #fileInput type="file" accept=".vtt,.txt,.mp4,.mov,.mp3,.wav,.m4a,.webm" style="display:none" (change)="onFileSelected($event)" />
              </div>
            </div>

            <!-- AI Summary and Actions -->
            <div class="grid grid-cols-2 gap-6">

              <!-- AI Meeting Summary -->
              <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-enterprise-secondary to-blue-900 p-1 shadow-xl">
                <div class="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 relative z-10 text-white h-full">
                  <div class="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                    <span class="material-icons text-indigo-300">auto_graph</span>
                    <h3 class="font-bold text-lg">AI Meeting Summary & Notes</h3>
                  </div>
                  <div class="space-y-4">
                    <p class="text-sm text-indigo-100 leading-relaxed font-light">{{ meeting.summary || 'No summary yet — upload a recording, VTT, or text transcript to generate one.' }}</p>
                    @if (meeting.decisions && meeting.decisions.length) {
                      <div class="text-xs text-indigo-100">
                        <div class="font-bold uppercase tracking-widest text-indigo-300 mb-1">Decisions</div>
                        <ul class="list-disc list-inside space-y-0.5">
                          @for (d of meeting.decisions; track d) { <li>{{ d }}</li> }
                        </ul>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Action Items -->
              <div class="bg-white rounded-2xl p-6 shadow-enterprise-soft border border-gray-100">
                <div class="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                  <h3 class="font-bold text-gray-800 text-base">Key Action Items</h3>
                  <button class="text-blue-600 text-xs font-bold hover:underline">Add</button>
                </div>
                <div class="space-y-3">
                  @for (action of meeting.actions; track action.id) {
                    <label class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer group">
                      <input type="checkbox" [checked]="action.done" class="mt-0.5 w-4 h-4 rounded text-enterprise-primary focus:ring-enterprise-primary border-gray-300">
                      <div class="flex-1">
                        <p class="text-sm font-medium text-gray-700 group-hover:text-gray-900" [class.line-through]="action.done" [class.text-gray-400]="action.done">{{ action.text }}</p>
                        <p class="text-[11px] text-gray-400 mt-1 font-bold">Assignee: {{ action.assignee }}</p>
                      </div>
                    </label>
                  }
                  @if (!meeting.actions.length) {
                    <p class="text-xs text-gray-400">No action items yet.</p>
                  }
                </div>
              </div>

            </div>

            <!-- Agenda & Project Review Queue -->
            <div class="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100 overflow-hidden">
              <div class="bg-gray-50/50 p-5 border-b border-gray-100">
                <h3 class="font-bold text-gray-800 text-lg">Agenda: Project Proposals for Review</h3>
              </div>
              <ul class="divide-y divide-gray-100">
                @for (item of meeting.agenda; track item.id) {
                  <li class="p-5 hover:bg-gray-50 flex items-center justify-between transition-colors">
                    <div class="flex items-center gap-4">
                      <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-sm">#{{ item.id }}</div>
                      <div>
                        <h4 class="font-bold text-gray-800 text-sm">{{ item.project }}</h4>
                        <p class="text-xs text-gray-500">{{ item.department }} • 15 min allocated</p>
                      </div>
                    </div>
                    <button class="btn border border-gray-200 text-gray-600 hover:border-enterprise-primary hover:text-enterprise-primary px-3 py-1.5 rounded-lg text-xs font-bold bg-white transition-all shadow-sm">Review File</button>
                  </li>
                }
                @if (!meeting.agenda.length) {
                  <li class="p-5 text-xs text-gray-400">No agenda items yet.</li>
                }
              </ul>
            </div>

            <!-- Process Diagram (BPMN), shown only when the transcript described a process -->
            @if (meeting.containsProcessFlow) {
              <div class="bg-white rounded-2xl shadow-enterprise-soft border border-gray-100 overflow-hidden">
                <div class="bg-gray-50/50 p-5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 class="font-bold text-gray-800 text-lg">Process Diagram{{ meeting.processName ? ': ' + meeting.processName : '' }}</h3>
                    <p class="text-xs text-gray-500 mt-0.5">Auto-generated from the transcript by the meeting agent.</p>
                  </div>
                  @if (meeting.bpmnXml) {
                    <button (click)="downloadBpmn(meeting)" class="btn border border-gray-200 text-gray-600 hover:border-enterprise-primary hover:text-enterprise-primary px-3 py-1.5 rounded-lg text-xs font-bold bg-white transition-all shadow-sm flex items-center gap-1">
                      <span class="material-icons text-sm">download</span> Download .bpmn
                    </button>
                  }
                </div>
                @if (meeting.bpmnStatus === 'generated' && meeting.bpmnXml) {
                  <div #bpmnContainer class="bpmn-container"></div>
                } @else if (meeting.bpmnStatus === 'failed') {
                  <div class="p-5 text-xs text-red-600">BPMN generation failed for this meeting. Check backend logs.</div>
                } @else {
                  <div class="p-5 text-xs text-gray-400">Waiting on the bpm-bpmn-export skill / generation to complete.</div>
                }
              </div>
            }

          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .upload-zone {
      border: 2px dashed #cbd5e1;
      border-radius: 0.75rem;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .upload-zone:hover { border-color: #6366f1; background: #f8fafc; }
    .upload-icon { color: #6366f1; font-size: 28px; }
    .upload-info { flex: 1; }
    .bpmn-container { width: 100%; height: 480px; }
  `]
})
export class MeetingCenterComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('bpmnContainer') bpmnContainerRef?: ElementRef<HTMLDivElement>;

  private bpmnViewer: any = null;
  private renderedBpmnXml: string | null = null;

  upcomingMeetings: MeetingCard[] = [
    {
      id: 1,
      type: 'EAC',
      title: 'Monthly Architecture Alignment Council',
      date: 'Aug 04, 2026',
      time: '10:00 AM - 11:30 AM',
      actions: [
        { id: 1, text: 'Review SOC2 Vendor Exception', assignee: 'Security Team', done: false },
        { id: 2, text: 'Approve Cloud Migration Budget', assignee: 'Finance', done: false },
        { id: 3, text: 'Circulate Previous MoM', assignee: 'EPMO', done: true },
      ],
      agenda: [
        { id: '102', project: 'Azure Data Lake Migration', department: 'Infrastructure' },
        { id: '103', project: 'AI Patient Triage Chatbot', department: 'Innovation Lab' }
      ]
    },
    {
      id: 2,
      type: 'BTA',
      title: 'Weekly Business Tech Intake',
      date: 'Aug 05, 2026',
      time: '02:00 PM - 03:00 PM',
      actions: [
        { id: 4, text: 'Validate Workday Integration constraints', assignee: 'HR Tech', done: false }
      ],
      agenda: [
        { id: '108', project: 'Workday Performance Module', department: 'Human Resources' }
      ]
    },
    {
      id: 3,
      type: 'PIC',
      title: 'Q3 Investment Validation Sign-off',
      date: 'Aug 10, 2026',
      time: '09:00 AM - 11:00 AM',
      actions: [],
      agenda: []
    }
  ];

  activeMeeting = signal<MeetingCard | null>(this.upcomingMeetings[0]);
  isProcessing = signal(false);
  uploadedFileName = signal<string | null>(null);
  uploadError = signal<string | null>(null);

  constructor(private meetingService: MeetingService) {}

  selectMeeting(meeting: MeetingCard) {
    this.activeMeeting.set(meeting);
    this.uploadedFileName.set(null);
    this.uploadError.set(null);
  }

  onFileSelected(event: any): void {
    const inputEl: HTMLInputElement = event.target;
    const file: File | undefined = inputEl?.files?.[0];
    if (!file) return;
    // Reset so selecting the same filename again still fires a change event next time.
    inputEl.value = '';

    const meeting = this.activeMeeting();
    if (!meeting) return;

    this.uploadError.set(null);
    this.uploadedFileName.set(file.name);
    this.isProcessing.set(true);

    this.ensureBackendMeeting(meeting).subscribe({
      next: (backendId) => {
        this.meetingService.uploadArtifact(backendId, file).subscribe({
          next: (result) => {
            meeting.summary = result.summary || undefined;
            meeting.decisions = result.decisions;
            meeting.actions = (result.action_items || []).map((a: ActionItem, i: number) => ({
              id: i + 1, text: a.text, assignee: a.assignee, done: false
            }));
            meeting.agenda = (result.agenda_items || []).map((a: AgendaItem, i: number) => ({
              id: String(i + 1), project: a.project, department: a.department || 'Unspecified'
            }));
            meeting.containsProcessFlow = result.contains_process_flow;
            meeting.processName = result.process_name;
            meeting.bpmnXml = result.bpmn_xml;
            meeting.bpmnStatus = result.bpmn_status;

            this.activeMeeting.set({ ...meeting });
            this.isProcessing.set(false);
          },
          error: (err) => {
            console.error('Failed to process meeting artifact:', err);
            this.uploadError.set(err?.error?.detail || 'Failed to process the uploaded file.');
            this.isProcessing.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Failed to create/find backend meeting:', err);
        this.uploadError.set('Failed to create meeting record on the server.');
        this.isProcessing.set(false);
      }
    });
  }

  private ensureBackendMeeting(meeting: MeetingCard): Observable<string> {
    if (meeting.backendMeetingId) {
      return of(meeting.backendMeetingId);
    }
    return this.meetingService.createMeeting({
      title: meeting.title,
      meeting_type: meeting.type,
      meeting_date: meeting.date,
      meeting_time: meeting.time
    }).pipe(
      map((created) => {
        meeting.backendMeetingId = created.id;
        return created.id;
      })
    );
  }

  downloadBpmn(meeting: MeetingCard): void {
    if (!meeting.bpmnXml) return;
    const blob = new Blob([meeting.bpmnXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(meeting.processName || meeting.title).replace(/\s+/g, '_')}.bpmn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  ngAfterViewChecked(): void {
    const meeting = this.activeMeeting();
    if (!meeting || meeting.bpmnStatus !== 'generated' || !meeting.bpmnXml || !this.bpmnContainerRef) return;
    if (this.renderedBpmnXml === meeting.bpmnXml) return;

    if (!this.bpmnViewer) {
      this.bpmnViewer = new BpmnViewer({ container: this.bpmnContainerRef.nativeElement });
    }
    const xml = meeting.bpmnXml;
    this.bpmnViewer.importXML(xml).then(() => {
      this.bpmnViewer.get('canvas').zoom('fit-viewport');
      this.renderedBpmnXml = xml;
    }).catch((err: any) => console.error('Failed to render BPMN diagram:', err));
  }

  ngOnDestroy(): void {
    this.bpmnViewer?.destroy();
  }
}
