import { useState, useRef } from "react";
import { projectsApi } from "../../../lib/api";

interface AIPopulationDropzoneProps {
  projectId: string;
  team: string;
  onExtractionComplete: (data: Record<string, any>) => void;
}

export function AIPopulationDropzone({ projectId, team, onExtractionComplete }: AIPopulationDropzoneProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsExtracting(true);
    setError(null);

    const fileArray = Array.from(files);

    try {
      const result = await projectsApi.extractTeamFields(projectId, team, fileArray);
      if (result.success && result.data) {
        onExtractionComplete(result.data);
      } else {
        throw new Error("Failed to extract data properly.");
      }
    } catch (err: any) {
      console.error("AI Extraction Error:", err);
      setError(err.message || "An error occurred during AI extraction.");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(true);
  };

  const onDragLeave = () => {
    setIsHovering(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="mb-8">
      <div 
        className={`w-full border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center relative overflow-hidden group cursor-pointer
          ${isHovering ? "border-[#818CF8] bg-indigo-500/10" : "border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50 hover:bg-indigo-500/10"}
        `}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          multiple 
          ref={fileInputRef}
          className="hidden" 
          onChange={(e) => handleFiles(e.target.files)}
          accept=".pdf,.docx,.xlsx,.txt"
        />
        
        {isExtracting ? (
          <div className="flex flex-col items-center animate-fade-in relative z-10 w-full py-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-4 relative">
              <span className="material-icons text-indigo-400 text-3xl animate-pulse">auto_awesome</span>
              {/* Outer pulsing ring */}
              <div className="absolute inset-0 rounded-2xl border-2 border-indigo-400 opacity-50 animate-ping"></div>
              {/* Scanline effect */}
              <div 
                className="absolute left-0 right-0 h-1 bg-indigo-400 blur-[1px] opacity-70"
                style={{
                  animation: "scanline 2s linear infinite",
                }}
              ></div>
            </div>
            
            <h3 className="text-lg font-bold text-white mb-2">Analyzing Documents...</h3>
            <p className="text-sm text-indigo-200/70 max-w-sm">
              Our AI is securely processing your files to automatically extract and populate the required {team.toUpperCase()} fields.
            </p>
            
            {/* Progress bar simulation */}
            <div className="w-64 h-1.5 bg-black/40 rounded-full mt-6 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                style={{
                  width: "100%",
                  animation: "progressPulse 2s ease-in-out infinite alternate"
                }}
              ></div>
            </div>
            <style>{`
              @keyframes scanline {
                0% { top: 0; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
              }
              @keyframes progressPulse {
                0% { opacity: 0.6; }
                100% { opacity: 1; }
              }
            `}</style>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-fade-in relative z-10 py-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-3">
              <span className="material-icons text-[24px]">troubleshoot</span>
            </div>
            <h3 className="text-[15px] font-bold text-white mb-1">AI Form Auto-Population</h3>
            <p className="text-[13px] text-slate-400 max-w-md mx-auto">
              Click or drag to automatically extract data from uploaded document(s) and fill this form.
            </p>
            {error && (
              <p className="text-red-400 text-xs mt-3 bg-red-900/30 px-3 py-1 rounded-full border border-red-500/20">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Ambient background glows */}
        {!isExtracting && (
          <>
            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/10 blur-[40px] rounded-full pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-500"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-violet-500/10 blur-[40px] rounded-full pointer-events-none group-hover:bg-violet-500/20 transition-all duration-500"></div>
          </>
        )}
      </div>
    </div>
  );
}
