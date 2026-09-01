import { useState } from "react";

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
}

export function MeetingCenterPage() {
  const [upcomingMeetings] = useState<Meeting[]>([
    { id: '1', title: 'EAC Architecture Alignment Vote', date: 'Today, Nov 14', time: '10:00 AM', type: 'EAC' },
    { id: '2', title: 'BTA Discovery: Cloud Migration', date: 'Today, Nov 14', time: '2:30 PM', type: 'BTA' },
    { id: '3', title: 'PIC Funding Approval', date: 'Tomorrow, Nov 15', time: '9:00 AM', type: 'PIC' },
    { id: '4', title: 'Security Gate K Review', date: 'Thu, Nov 16', time: '1:00 PM', type: 'SEC' }
  ]);
  
  const [activeMeetingId, setActiveMeetingId] = useState<string>('1');
  
  const activeMeeting = upcomingMeetings.find(m => m.id === activeMeetingId);

  return (
    <div className="animate-fade-in p-6 min-h-full" style={{ background: "#0f172a", color: "#f8fafc" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="material-icons text-blue-500 text-[32px]">groups</span>
            Enterprise Meeting Center
          </h1>
          <p className="text-sm font-medium text-slate-400 mt-1">Manage governance council meetings and AI-driven agenda tracking.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5">
          <span className="material-icons text-[18px]">add</span> Schedule Meeting
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Schedule Sidebar */}
        <div className="space-y-6">
          <div className="bg-[#1e293b] rounded-2xl shadow-sm border border-white/10 p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-white/10 pb-2 mb-4">Upcoming Schedule</h3>
            
            <div className="space-y-3">
              {upcomingMeetings.map((meeting) => {
                const isActive = activeMeetingId === meeting.id;
                const typeColor = meeting.type === 'EAC' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30';
                
                return (
                  <div 
                    key={meeting.id}
                    onClick={() => setActiveMeetingId(meeting.id)} 
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${isActive ? 'bg-indigo-500/20 border-indigo-400/50' : 'bg-slate-800 border-white/5 hover:border-indigo-400/30'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border ${typeColor}`}>
                        {meeting.type} COUNCIL
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">{meeting.time}</span>
                    </div>
                    <h4 className="font-bold text-white text-sm mb-1 leading-snug">{meeting.title}</h4>
                    <p className="text-xs text-slate-400">{meeting.date}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Meeting Workspace */}
        {activeMeeting && (
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Context Header */}
            <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>{activeMeeting.title}</h2>
                  <div className="flex gap-4 text-xs font-medium text-slate-400">
                    <span className="flex items-center gap-1"><span className="material-icons text-[14px]">event</span> {activeMeeting.date}</span>
                    <span className="flex items-center gap-1"><span className="material-icons text-[14px]">schedule</span> {activeMeeting.time}</span>
                    <span className="flex items-center gap-1"><span className="material-icons text-[14px]">videocam</span> MSTeams Bridge</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full border-2 border-[#1e293b] bg-blue-500 text-white flex items-center justify-center text-xs font-bold">AK</div>
                    <div className="w-8 h-8 rounded-full border-2 border-[#1e293b] bg-orange-500 text-white flex items-center justify-center text-xs font-bold">JR</div>
                    <div className="w-8 h-8 rounded-full border-2 border-[#1e293b] bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold">+5</div>
                  </div>
                  <button className="bg-slate-700 hover:bg-slate-600 text-slate-300 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                    <span className="material-icons text-[16px]">person_add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* AI Summary and Actions */}
            <div className="grid grid-cols-2 gap-6">
              
              {/* AI Meeting Summary */}
              <div className="relative overflow-hidden rounded-2xl p-1 shadow-xl border border-white/10" style={{ background: 'linear-gradient(135deg, #312E81 0%, #1E40AF 100%)' }}>
                <div className="bg-black/20 backdrop-blur-md rounded-xl p-6 relative z-10 text-white h-full">
                  <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                    <span className="material-icons text-indigo-300">auto_graph</span>
                    <h3 className="font-bold text-lg">AI Meeting Summary & Notes</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm text-indigo-100 leading-relaxed font-light">"The committee largely agreed with the cloud migration strategy but highlighted a dependency on the SOC2 vendor compliance for Azure modules. AI suggests deferring final approval until Security signs off."</p>
                    <div className="bg-black/30 rounded-lg py-3 px-4 flex justify-between items-center border border-white/5 cursor-pointer hover:bg-black/40 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="material-icons text-rose-400 text-[18px]">mic</span>
                        <span className="text-xs font-medium uppercase tracking-widest text-slate-300">Live Transcript Active</span>
                      </div>
                      <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Items */}
              <div className="bg-[#1e293b] rounded-2xl p-6 shadow-sm border border-white/10">
                <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                  <span className="material-icons text-orange-400">assignment_turned_in</span>
                  <h3 className="font-bold text-white text-lg">AI Suggested Actions</h3>
                </div>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 bg-slate-800 border border-white/5 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-blue-500 rounded border-slate-600 bg-slate-800" />
                    <div>
                      <div className="text-sm font-semibold text-white">Add Security Sign-off Dependency</div>
                      <div className="text-xs text-slate-400 mt-1">Assign to: J. Doe (Security Architect)</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 bg-slate-800 border border-white/5 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-blue-500 rounded border-slate-600 bg-slate-800" />
                    <div>
                      <div className="text-sm font-semibold text-white">Schedule Vendor Risk Assessment</div>
                      <div className="text-xs text-slate-400 mt-1">Due before next EAC session</div>
                    </div>
                  </label>
                </div>
                <button className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded-lg text-sm font-bold transition-colors">
                  Save Action Items to Project
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
