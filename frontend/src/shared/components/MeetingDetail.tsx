import React, { useEffect, useRef, useState } from "react";
import BpmnViewer from "bpmn-js/lib/NavigatedViewer";

export interface ActionItem {
  id: number;
  text: string;
  assignee: string;
}

export interface MeetingCard {
  id: number;
  type: string;
  title: string;
  date: string;
  time: string;
  actions: ActionItem[];
  summary?: string;
  decisions?: string[];
  containsProcessFlow?: boolean;
  processName?: string | null;
  bpmnXml?: string | null;
  bpmnStatus?: string | null; // "generating" | "generated" | "failed"
}

interface MeetingDetailProps {
  meeting: MeetingCard;
}

export function MeetingDetail({ meeting }: MeetingDetailProps) {
  const bpmnContainerRef = useRef<HTMLDivElement>(null);
  const bpmnViewerRef = useRef<any>(null);

  useEffect(() => {
    // Only attempt to render if we have the container, the status is generated, and we have XML
    if (
      !bpmnContainerRef.current ||
      meeting.bpmnStatus !== "generated" ||
      !meeting.bpmnXml
    ) {
      return;
    }

    if (!bpmnViewerRef.current) {
      bpmnViewerRef.current = new BpmnViewer({
        container: bpmnContainerRef.current,
      });
    }

    const loadXml = async () => {
      try {
        await bpmnViewerRef.current.importXML(meeting.bpmnXml);
        // Attempt to fit viewport after rendering
        try {
          bpmnViewerRef.current.get("canvas").zoom("fit-viewport");
        } catch (e) {
          // If layout hasn't settled yet, give it a tiny delay
          setTimeout(() => {
            try {
              bpmnViewerRef.current.get("canvas").zoom("fit-viewport");
            } catch (err) {
              console.error("Zoom failed after retry", err);
            }
          }, 150);
        }
      } catch (err) {
        console.error("Failed to render BPMN diagram:", err);
      }
    };

    loadXml();

    return () => {
      // Clean up viewer on unmount
      if (bpmnViewerRef.current) {
        bpmnViewerRef.current.destroy();
        bpmnViewerRef.current = null;
      }
    };
  }, [meeting.bpmnXml, meeting.bpmnStatus]);

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* AI Meeting Summary */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden h-[360px] group transition-all hover:shadow-md">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-5 py-4 flex items-center gap-2.5 border-b border-indigo-100">
            <span className="material-icons text-indigo-600 text-[20px]">auto_awesome</span>
            <h3 className="font-bold text-slate-800 text-base">AI Summary & Notes</h3>
          </div>
          
          <div className="p-5 flex-1 overflow-y-auto">
            {meeting.summary ? (
              <>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">{meeting.summary}</p>
                {meeting.decisions && meeting.decisions.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2.5 flex items-center gap-1.5">
                      <span className="material-icons text-[14px]">gavel</span> Key Decisions
                    </div>
                    <ul className="space-y-2">
                       {meeting.decisions.map((d, idx) => (
                         <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                           <span className="material-icons text-emerald-500 text-[18px] shrink-0 mt-0.5">check_circle</span>
                           <span className="font-medium">{d}</span>
                         </li>
                       ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-100">
                  <span className="material-icons text-3xl text-slate-300">summarize</span>
                </div>
                <p className="text-sm font-medium text-slate-500">No summary generated yet</p>
                <p className="text-xs mt-1">Upload a recording or transcript to begin.</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Items */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 flex flex-col overflow-hidden h-[360px] group transition-all hover:shadow-md">
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 border-b border-orange-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-icons text-orange-500 text-[20px]">checklist</span>
              <h3 className="font-bold text-slate-800 text-base">Action Items</h3>
            </div>
            <span className="bg-orange-100 text-orange-600 text-xs font-bold px-2 py-0.5 rounded-md border border-orange-200">
              {meeting.actions.length}
            </span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <div className="space-y-3">
              {meeting.actions.map((action) => (
                <div key={action.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-orange-200 transition-colors">
                  <span className="material-icons text-slate-300 text-[18px] mt-0.5">radio_button_unchecked</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">{action.text}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 uppercase">
                        {action.assignee.substring(0, 2)}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">{action.assignee}</p>
                    </div>
                  </div>
                </div>
              ))}
              {meeting.actions.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-12">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 border border-slate-100">
                    <span className="material-icons text-3xl text-slate-300">task</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">No action items extracted</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* BPMN Process Diagram Layer */}
      {meeting.containsProcessFlow && (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="bg-gradient-to-r from-teal-50 to-emerald-50 px-5 py-4 border-b border-teal-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-icons text-teal-600 text-[20px]">account_tree</span>
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  Process Diagram{meeting.processName ? `: ${meeting.processName}` : ""}
                </h3>
              </div>
            </div>
            {meeting.bpmnXml && (
              <div className="flex items-center gap-2">
                <button className="bg-white border border-slate-200 text-slate-600 hover:border-teal-500 hover:text-teal-600 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-sm flex items-center gap-1">
                  <span className="material-icons text-[14px]">download</span> Download XML
                </button>
              </div>
            )}
          </div>

          <div className="relative bg-slate-50/50">
            {meeting.bpmnStatus === "generated" && meeting.bpmnXml ? (
              <div ref={bpmnContainerRef} className="h-[450px] w-full cursor-grab active:cursor-grabbing border-none outline-none"></div>
            ) : meeting.bpmnStatus === "failed" ? (
              <div className="p-10 flex flex-col items-center justify-center text-red-500 bg-red-50/50 h-[300px]">
                <span className="material-icons text-4xl mb-2 text-red-400">error_outline</span>
                <p className="text-sm font-bold">BPMN generation failed</p>
              </div>
            ) : (
              <div className="p-10 flex flex-col items-center justify-center text-slate-500 h-[300px]">
                <span className="material-icons text-3xl animate-spin mb-3 text-teal-500">sync</span>
                <p className="text-sm font-bold text-slate-600">Generating process diagram...</p>
                <p className="text-xs text-slate-400 mt-2">AI is structuring the workflow coordinates.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
