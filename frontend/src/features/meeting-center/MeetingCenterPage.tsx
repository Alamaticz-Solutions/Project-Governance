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
    <div className="animate-fade-in p-6 bg-surface min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="material-icons text-blue-600 text-[32px]">groups</span>
            Enterprise Meeting Center
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-1">Manage governance council meetings and AI-driven agenda tracking.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5">
          <span className="material-icons text-[18px]">add</span> Schedule Meeting
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Schedule Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2 mb-4">Upcoming Schedule</h3>
            
            <div className="space-y-3">
              {upcomingMeetings.map((meeting) => {
                const isActive = activeMeetingId === meeting.id;
                const typeColor = meeting.type === 'EAC' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700';
                
                return (
                  <div 
                    key={meeting.id}
                    onClick={() => setActiveMeetingId(meeting.id)} 
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${isActive ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100 hover:border-indigo-100'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded ${typeColor}`}>
                        {meeting.type} COUNCIL
                      </span>
                      <span className="text-[11px] font-bold text-gray-400">{meeting.time}</span>
                    </div>
                    <h4 className="font-bold text-gray-800 text-sm mb-1 leading-snug">{meeting.title}</h4>
                    <p className="text-xs text-gray-500">{meeting.date}</p>
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
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-display)' }}>{activeMeeting.title}</h2>
                  <div className="flex gap-4 text-xs font-medium text-gray-500">
                    <span className="flex items-center gap-1"><span className="material-icons text-[14px]">event</span> {activeMeeting.date}</span>
                    <span className="flex items-center gap-1"><span className="material-icons text-[14px]">schedule</span> {activeMeeting.time}</span>
                    <span className="flex items-center gap-1"><span className="material-icons text-[14px]">videocam</span> MSTeams Bridge</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-500 text-white flex items-center justify-center text-xs font-bold">AK</div>
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-orange-500 text-white flex items-center justify-center text-xs font-bold">JR</div>
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold">+5</div>
                  </div>
                  <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
                    <span className="material-icons text-[16px]">person_add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* AI Summary and Actions */}
            <div className="grid grid-cols-2 gap-6">
              
              {/* AI Meeting Summary */}
              <div className="relative overflow-hidden rounded-2xl p-1 shadow-xl" style={{ background: 'linear-gradient(135deg, #312E81 0%, #1E40AF 100%)' }}>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 relative z-10 text-white h-full">
                  <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
                    <span className="material-icons text-indigo-300">auto_graph</span>
                    <h3 className="font-bold text-lg">AI Meeting Summary & Notes</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm text-indigo-100 leading-relaxed font-light">"The committee largely agreed with the cloud migration strategy but highlighted a dependency on the SOC2 vendor compliance for Azure modules. AI suggests deferring final approval until Security signs off."</p>
                    <div className="bg-black/20 rounded-lg py-3 px-4 flex justify-between items-center border border-white/5 cursor-pointer hover:bg-black/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="material-icons text-rose-400 text-[18px]">mic</span>
                        <span className="text-xs font-medium uppercase tracking-widest text-gray-300">Live Transcript Active</span>
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
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                  <span className="material-icons text-orange-500">assignment_turned_in</span>
                  <h3 className="font-bold text-gray-800 text-lg">AI Suggested Actions</h3>
                </div>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg cursor-pointer hover:bg-blue-50/50 transition-colors">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-blue-600 rounded border-gray-300" />
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Add Security Sign-off Dependency</div>
                      <div className="text-xs text-gray-500 mt-1">Assign to: J. Doe (Security Architect)</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg cursor-pointer hover:bg-blue-50/50 transition-colors">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 accent-blue-600 rounded border-gray-300" />
                    <div>
                      <div className="text-sm font-semibold text-gray-800">Schedule Vendor Risk Assessment</div>
                      <div className="text-xs text-gray-500 mt-1">Due before next EAC session</div>
                    </div>
                  </label>
                </div>
                <button className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-bold transition-colors">
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
