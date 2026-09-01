import { useNavigate } from "react-router";

interface ConfirmationScreenProps {
  title?: string;
  message?: string;
  subMessage?: string;
  returnLabel?: string;
  returnRoute?: string;
  showReturnButton?: boolean;
  iconName?: string;
  iconColor?: string;
  iconBg?: string;
  children?: React.ReactNode;
}

export function ConfirmationScreen({
  title = "Completed Successfully!",
  message = "Your request has been processed.",
  subMessage = "",
  returnLabel = "Return to Pending Reviews",
  returnRoute = "/team-inbox",
  showReturnButton = true,
  iconName = "check_circle",
  iconColor = "#10B981",
  iconBg = "linear-gradient(135deg, #E3FCEF 0%, #D1FAE5 100%)",
  children
}: ConfirmationScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center text-center max-w-[620px] mx-auto my-[40px] px-[40px] py-[56px] bg-white border border-slate-200/80 rounded-[20px] shadow-[0_20px_50px_rgba(16,24,40,0.12)] font-sans animate-fade-in relative z-10 w-full">
      <div 
        className="w-[88px] h-[88px] rounded-full flex items-center justify-center mb-[28px] shadow-[0_8px_24px_rgba(16,185,129,0.2)]"
        style={{ background: iconBg }}
      >
        <span className="material-icons text-[52px]" style={{ color: iconColor }}>
          {iconName}
        </span>
      </div>
      
      <h2 className="m-0 mb-3 text-[26px] font-extrabold text-[#172B4D] tracking-[-0.3px]" style={{ fontFamily: "'Outfit', sans-serif" }}>
        {title}
      </h2>
      
      <p className="m-0 text-[#505F79] text-[15px] leading-relaxed max-w-[440px]">
        {message}
      </p>
      
      {subMessage && (
        <p className="mt-2.5 mb-0 text-[#6B778C] text-[13px] leading-relaxed max-w-[440px]">
          {subMessage}
        </p>
      )}
      
      <div className="mt-8 flex gap-4 justify-center flex-wrap w-full">
        {showReturnButton && (
          <button 
            type="button" 
            onClick={() => navigate(returnRoute)}
            className="px-7 py-3 rounded-xl font-bold text-[14px] text-white border-none cursor-pointer shadow-[0_4px_14px_rgba(16,185,129,0.3)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_8px_20px_rgba(16,185,129,0.4)]"
            style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}
          >
            {returnLabel}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
