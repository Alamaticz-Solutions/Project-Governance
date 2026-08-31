import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

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
                    <p class="text-sm text-indigo-100 leading-relaxed font-light">"The committee largely agreed with the cloud migration strategy but highlighted a dependency on the SOC2 vendor compliance for Azure modules. AI suggests deferring final approval until Security signs off."</p>
                    <div class="bg-black/20 rounded-lg py-3 px-4 flex justify-between items-center border border-white/5 cursor-pointer hover:bg-black/30 transition-colors">
                      <div class="flex items-center gap-2">
                        <span class="material-icons text-rose-400 text-[18px]">mic</span>
                        <span class="text-xs font-medium uppercase tracking-widest text-gray-300">Live Transcript Active</span>
                      </div>
                      <span class="flex h-2 w-2">
                        <span class="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    </div>
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
              </ul>
            </div>

          </div>
        }
      </div>
    </div>
  `,
  styles: []
})
export class MeetingCenterComponent {
  upcomingMeetings = [
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

  activeMeeting = signal<any>(this.upcomingMeetings[0]);

  selectMeeting(meeting: any) {
    this.activeMeeting.set(meeting);
  }
}
