import { Component, signal, AfterViewChecked, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-in min-h-[calc(100vh-4rem)] bg-[#0f172a] text-slate-100 relative overflow-hidden font-sans">
      <!-- Deep Gradient Background (ChatGPT Voice Style) -->
      <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#111827] to-[#1e1b4b] z-0"></div>
      <div class="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-600/20 rounded-full blur-[150px] pointer-events-none mix-blend-screen z-0 animate-pulse-slow"></div>
      <div class="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0"></div>

      <div class="max-w-7xl mx-auto p-6 lg:p-8 relative z-10">
      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="font-display text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <div class="bg-indigo-600 text-white w-10 h-10 rounded-lg flex items-center justify-center shadow-md">
              <span class="material-icons text-[24px]">groups</span>
            </div>
            Enterprise Meeting Center
          </h1>
          <p class="text-sm font-medium text-slate-400 mt-2">Manage governance council meetings and AI-driven agenda tracking.</p>
        </div>
          <!-- Outlook-Style Schedule Button -->
          <div class="relative group cursor-pointer z-50">
            <button (click)="isScheduling.set(true)" class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all w-full md:w-auto border border-blue-400/20 hover:scale-105">
              <span class="material-icons text-[20px]">calendar_today</span> 
              <span>Schedule Meeting</span>
            </button>
          </div>
        </div>

        <!-- Schedule Meeting Modal -->
        @if (isScheduling()) {
          <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div class="glass-card w-full max-w-md rounded-2xl border border-slate-700/50 shadow-2xl shadow-indigo-900/50 overflow-hidden flex flex-col">
              <div class="bg-gradient-to-r from-slate-800 to-slate-800/80 px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="material-icons text-indigo-400">event_note</span>
                  <h3 class="text-lg font-bold text-white">Schedule New Meeting</h3>
                </div>
                <button (click)="isScheduling.set(false)" class="text-slate-400 hover:text-white transition-colors">
                  <span class="material-icons">close</span>
                </button>
              </div>
              
              <div class="p-6 flex flex-col gap-4 bg-slate-900/50">
                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Meeting Title</label>
                  <input type="text" [(ngModel)]="newMeeting.title" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" placeholder="e.g. Weekly Strategy Sync">
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Council Type</label>
                    <select [(ngModel)]="newMeeting.type" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none">
                      <option value="EAC">EAC Council</option>
                      <option value="BTA">BTA Council</option>
                      <option value="PIC">PIC Council</option>
                      <option value="SYNC">Team Sync</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date</label>
                    <input type="date" [(ngModel)]="newMeeting.date" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all [color-scheme:dark]">
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Time Duration</label>
                  <select [(ngModel)]="newMeeting.time" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none">
                    <option value="09:00 AM - 10:00 AM">09:00 AM - 10:00 AM</option>
                    <option value="10:00 AM - 11:30 AM">10:00 AM - 11:30 AM</option>
                    <option value="01:00 PM - 02:00 PM">01:00 PM - 02:00 PM</option>
                    <option value="02:00 PM - 03:00 PM">02:00 PM - 03:00 PM</option>
                    <option value="03:00 PM - 04:30 PM">03:00 PM - 04:30 PM</option>
                  </select>
                </div>
              </div>

              <div class="px-6 py-4 border-t border-slate-700/50 bg-slate-800/30 flex justify-end gap-3">
                <button (click)="isScheduling.set(false)" class="px-4 py-2 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors">Cancel</button>
                <button (click)="saveNewMeeting()" [disabled]="!newMeeting.title" class="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md transition-all flex items-center gap-2">
                  <span class="material-icons text-[18px]">send</span> Schedule
                </button>
              </div>
            </div>
          </div>
        }

      <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        <!-- Upcoming Schedule Sidebar -->
        <div class="xl:col-span-3 flex flex-col gap-4">
          <div class="bg-slate-800/50 backdrop-blur-md rounded-xl shadow-sm border border-slate-700 p-5">
            <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
              <h3 class="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <span class="material-icons text-[16px]">calendar_month</span> Upcoming Schedule
              </h3>
            </div>

            <div class="space-y-3">
              @for (meeting of upcomingMeetings; track meeting.id) {
                <div (click)="selectMeeting(meeting)"
                     class="group p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
                     [ngClass]="activeMeeting()?.id === meeting.id ? 'bg-indigo-900/40 border-indigo-500 shadow-sm' : 'bg-slate-800 border-slate-700 hover:border-indigo-400'">
                  
                  <div class="flex justify-between items-start mb-2.5">
                    <span class="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded"
                          [ngClass]="meeting.type === 'EAC' ? 'bg-purple-900/50 text-purple-300' : meeting.type === 'BTA' ? 'bg-blue-900/50 text-blue-300' : 'bg-emerald-900/50 text-emerald-300'">
                      {{ meeting.type }} COUNCIL
                    </span>
                    <span class="text-[11px] font-bold text-slate-500 group-hover:text-indigo-300 transition-colors">{{ meeting.time.split(' - ')[0] }}</span>
                  </div>
                  <h4 class="font-bold text-slate-200 text-sm mb-1.5 leading-snug group-hover:text-white transition-colors">{{ meeting.title }}</h4>
                  <p class="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <span class="material-icons text-[14px]">event</span> {{ meeting.date }}
                  </p>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Meeting Workspace -->
        @if (activeMeeting(); as meeting) {
          <div class="xl:col-span-9 flex flex-col gap-6 animate-fade-in">

            <!-- Context Header & Upload Zone -->
            <div class="bg-slate-800/50 backdrop-blur-md rounded-xl p-6 shadow-sm border border-slate-700 flex flex-col xl:flex-row gap-6 justify-between relative overflow-hidden">
              <div class="flex flex-col gap-4 flex-1 z-10">
                <div>
                  <h2 class="font-display text-2xl font-bold text-white mb-2">{{ meeting.title }}</h2>
                  <div class="flex flex-wrap gap-3 text-xs font-semibold text-slate-400">
                    <span class="flex items-center gap-1 bg-slate-900/50 px-2.5 py-1 rounded-md"><span class="material-icons text-[16px] text-slate-500">event</span> {{ meeting.date }}</span>
                    <span class="flex items-center gap-1 bg-slate-900/50 px-2.5 py-1 rounded-md"><span class="material-icons text-[16px] text-slate-500">schedule</span> {{ meeting.time }}</span>
                    <span class="flex items-center gap-1 bg-emerald-900/20 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-900/30"><span class="material-icons text-[16px]">videocam</span> MS Teams</span>
                  </div>
                </div>
                
                <div class="flex items-center gap-2 mt-auto pt-2">
                  <div class="flex -space-x-2">
                    <div class="w-8 h-8 rounded-full border-2 border-slate-800 bg-blue-500 text-white flex items-center justify-center text-xs font-bold shadow-sm z-30">AK</div>
                    <div class="w-8 h-8 rounded-full border-2 border-slate-800 bg-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-sm z-20">JR</div>
                    <div class="w-8 h-8 rounded-full border-2 border-slate-800 bg-slate-600 text-white flex items-center justify-center text-xs font-bold shadow-sm z-10 hover:bg-slate-500 cursor-pointer">+5</div>
                  </div>
                  <button class="w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-colors ml-1">
                    <span class="material-icons text-[18px]">person_add</span>
                  </button>
                </div>
              </div>

              <!-- Upload Component -->
              <div class="w-full xl:w-5/12 z-10 flex flex-col justify-center">
                <div class="upload-zone group" (click)="fileInput.click()" [class.processing]="isProcessing()">
                  <div class="relative flex flex-col items-center justify-center gap-2 text-center p-5">
                    @if (isProcessing()) {
                      <div class="w-12 h-12 rounded-full bg-indigo-900/50 flex items-center justify-center mb-1">
                        <span class="material-icons text-indigo-400 text-2xl animate-spin">sync</span>
                      </div>
                      <div class="font-bold text-sm text-indigo-300">Analyzing Meeting...</div>
                      <div class="text-[11px] text-indigo-500 font-medium">Extracting summaries & flows</div>
                    } @else if (uploadedFileName()) {
                      <div class="w-12 h-12 rounded-full bg-emerald-900/50 flex items-center justify-center mb-1">
                        <span class="material-icons text-emerald-400 text-2xl">task_alt</span>
                      </div>
                      <div class="font-bold text-sm text-slate-200 line-clamp-1 w-full px-2" title="{{ uploadedFileName() }}">{{ uploadedFileName() }}</div>
                      <div class="text-[11px] text-emerald-500 font-bold">Processed Successfully</div>
                      <button type="button" class="mt-2 text-[11px] font-bold text-indigo-400 hover:text-indigo-200 flex items-center gap-1 bg-indigo-900/20 hover:bg-indigo-900/40 px-3 py-1.5 rounded-full transition-colors" (click)="$event.stopPropagation(); fileInput.click()">
                        <span class="material-icons text-[14px]">upload_file</span> Upload Different File
                      </button>
                    } @else {
                      <div class="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-indigo-900/50 flex items-center justify-center transition-colors mb-1">
                        <span class="material-icons text-indigo-400 text-2xl">cloud_upload</span>
                      </div>
                      <div class="font-bold text-sm text-slate-300">Upload Transcript / Recording</div>
                      <div class="text-[11px] text-slate-500">Supports .vtt, .txt, .mp4, .mp3</div>
                    }

                    @if (uploadError()) {
                      <div class="text-[11px] text-red-400 font-bold bg-red-900/20 px-2 py-1 rounded-md flex items-center gap-1 mt-1">
                        <span class="material-icons text-[14px]">error</span> {{ uploadError() }}
                      </div>
                    }
                  </div>
                  <input #fileInput type="file" accept=".vtt,.txt,.mp4,.mov,.mp3,.wav,.m4a,.webm" style="display:none" (change)="onFileSelected($event)" />
                </div>
              </div>
            </div>

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
                      <label class="flex items-start gap-3 p-3 bg-slate-900/40 hover:bg-slate-900/60 rounded-lg border border-slate-700 cursor-pointer group transition-colors">
                        <div class="relative flex items-center justify-center mt-0.5">
                          <input type="checkbox" [checked]="action.done" class="w-4 h-4 rounded border-slate-600 bg-slate-800 transition-all peer cursor-pointer appearance-none checked:bg-indigo-600 checked:border-indigo-600 shadow-sm">
                          <span class="material-icons text-white text-[12px] absolute pointer-events-none opacity-0 peer-checked:opacity-100">check</span>
                        </div>
                        <div class="flex-1">
                          <p class="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors" [class.line-through]="action.done" [class.opacity-50]="action.done">{{ action.text }}</p>
                          <div class="flex items-center gap-1.5 mt-1.5">
                            <div class="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-400 uppercase">{{ action.assignee.substring(0, 2) }}</div>
                            <p class="text-[11px] text-slate-500 font-medium">{{ action.assignee }}</p>
                          </div>
                        </div>
                      </label>
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

            <!-- Agenda & Project Review Queue -->
            <div class="bg-slate-800/50 backdrop-blur-md rounded-xl shadow-sm border border-slate-700 overflow-hidden">
              <div class="bg-slate-900/40 px-5 py-4 border-b border-slate-700 flex items-center gap-2.5">
                <span class="material-icons text-blue-400 text-[20px]">view_agenda</span>
                <h3 class="font-bold text-white text-base">Project Proposals Reviewed</h3>
              </div>
              <ul class="divide-y divide-slate-700">
                @for (item of meeting.agenda; track item.id) {
                  <li class="p-4 hover:bg-slate-900/40 flex items-center justify-between transition-colors group">
                    <div class="flex items-center gap-4">
                      <div class="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-indigo-400 font-bold flex flex-col items-center justify-center text-[10px] group-hover:border-indigo-500 group-hover:bg-indigo-900/30 transition-colors">
                        <span class="uppercase tracking-wide leading-none text-slate-600">PRJ</span>
                        <span class="text-sm text-slate-200">{{ item.id }}</span>
                      </div>
                      <div>
                        <h4 class="font-bold text-slate-200 text-sm group-hover:text-indigo-300 transition-colors">{{ item.project }}</h4>
                        <p class="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <span class="material-icons text-[14px]">business</span> {{ item.department }}
                        </p>
                      </div>
                    </div>
                    <button class="bg-slate-800 border border-slate-700 text-slate-300 hover:border-indigo-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1">
                      Review <span class="material-icons text-[14px]">arrow_forward</span>
                    </button>
                  </li>
                }
                @if (!meeting.agenda.length) {
                  <li class="p-8 text-center text-slate-500 flex flex-col items-center">
                    <div class="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mb-2">
                      <span class="material-icons text-2xl text-slate-600">subject</span>
                    </div>
                    <p class="text-sm font-medium text-slate-400">No agenda items extracted</p>
                  </li>
                }
              </ul>
            </div>

            <!-- Process Diagram (BPMN) -->
            @if (meeting.containsProcessFlow) {
              <div class="bg-slate-800/50 backdrop-blur-md rounded-xl shadow-sm border border-slate-700 overflow-hidden mb-8">
                <div class="bg-slate-900/40 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <span class="material-icons text-emerald-400 text-[20px]">account_tree</span>
                    <div>
                      <h3 class="font-bold text-white text-base">Process Diagram{{ meeting.processName ? ': ' + meeting.processName : '' }}</h3>
                    </div>
                  </div>
                  @if (meeting.bpmnXml) {
                    <button (click)="downloadBpmn(meeting)" class="bg-slate-800 border border-slate-700 text-slate-300 hover:border-emerald-600 hover:text-emerald-400 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1">
                      <span class="material-icons text-[14px]">download</span> Download BPMN
                    </button>
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
        }
      </div>
    </div>
  `,
  styles: [`
    .upload-zone {
      border: 2px dashed #475569;
      border-radius: 0.75rem;
      background: #1e293b;
      cursor: pointer;
      transition: all 0.2s ease-in-out;
      min-height: 140px;
    }
    .upload-zone:hover { 
      border-color: #6366f1; 
      background: #1e293b;
    }
    .upload-zone.processing {
      border-color: #4f46e5;
      background: #1e1b4b;
      pointer-events: none;
    }
    .bpmn-container { 
      width: 100%; 
      height: 400px;
      cursor: grab;
    }
    .bpmn-container:active {
      cursor: grabbing;
    }
    .animate-pulse-slow {
      animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: .7; transform: scale(1.05); }
    }
    .glass-card {
      background: rgba(30, 41, 59, 0.8);
      backdrop-filter: blur(12px);
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
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }
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
      date: '2026-08-04',
      time: '10:00 AM - 11:30 AM',
      actions: [],
      agenda: []
    },
    {
      id: 2,
      type: 'BTA',
      title: 'Weekly Business Tech Intake',
      date: '2026-08-05',
      time: '02:00 PM - 03:00 PM',
      actions: [],
      agenda: []
    },
    {
      id: 3,
      type: 'PIC',
      title: 'Q3 Investment Validation Sign-off',
      date: '2026-08-10',
      time: '09:00 AM - 11:00 AM',
      actions: [],
      agenda: []
    }
  ];

  activeMeeting = signal<MeetingCard | null>(this.upcomingMeetings[0]);
  isProcessing = signal(false);
  uploadedFileName = signal<string | null>(null);
  uploadError = signal<string | null>(null);
  
  isScheduling = signal(false);
  newMeeting = {
    title: '',
    type: 'SYNC',
    date: new Date().toISOString().split('T')[0],
    time: '10:00 AM - 11:30 AM'
  };

  constructor(private meetingService: MeetingService) {}

  saveNewMeeting() {
    if (!this.newMeeting.title) return;
    
    const nextId = Math.max(...this.upcomingMeetings.map(m => m.id), 0) + 1;
    const createdMeeting: MeetingCard = {
      id: nextId,
      type: this.newMeeting.type,
      title: this.newMeeting.title,
      date: this.newMeeting.date,
      time: this.newMeeting.time,
      actions: [],
      agenda: []
    };
    
    // Add to the front of the list
    this.upcomingMeetings = [createdMeeting, ...this.upcomingMeetings];
    this.selectMeeting(createdMeeting);
    this.isScheduling.set(false);
    
    // Reset form
    this.newMeeting.title = '';
  }

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
