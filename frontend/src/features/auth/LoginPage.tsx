import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../../app/AuthContext";
import { ApiError } from "../../lib/apiClient";

const FEATURES = [
  { icon: 'account_tree', label: 'End-to-end governance workflow engine' },
  { icon: 'fact_check',   label: 'Gate-based committee reviews (A → CAB)' },
  { icon: 'security',     label: 'HIPAA & ISO 27001 compliance tracking' },
  { icon: 'smart_toy',    label: 'GenAI-powered document extraction' },
  { icon: 'dashboard',    label: 'Real-time executive dashboards' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email || password.length < 6) return;

    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const emailError = touched.email && !email ? "Valid email is required" : null;
  const passwordError = touched.password && password.length < 6 ? "Password must be at least 6 characters" : null;

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-1 flex-col bg-gradient-to-br from-[#091E42] via-[#0052CC] to-[#00B8D9] p-12 text-white">
        <div className="flex items-center gap-3.5 mb-20">
          <div className="w-[52px] h-[52px] bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-md">
            <span className="material-icons text-[28px]">hub</span>
          </div>
          <div>
            <h1 className="font-extrabold text-[22px] text-white tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
              ABC Health
            </h1>
            <p className="text-[13px] text-white/60">Project Governance Portal</p>
          </div>
        </div>

        <div className="max-w-[480px]">
          <h2 className="font-extrabold text-4xl mb-5 leading-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
            One platform for every project from idea to go-live
          </h2>
          <p className="text-base text-white/70 leading-relaxed mb-10">
            Replacing 10–15 fragmented forms with a single intelligent governance workflow engine.
          </p>

          <div className="flex flex-col gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-3.5 text-[15px] text-white/85 font-medium hover:text-white transition-colors">
                <div className="w-10 h-10 bg-white/10 rounded-[10px] flex items-center justify-center backdrop-blur-md shrink-0">
                  <span className="material-icons text-[20px]">{f.icon}</span>
                </div>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-[480px] bg-[#F7F8FC] flex items-center justify-center p-8 shrink-0">
        <div className="w-full max-w-[400px] bg-white rounded-2xl p-10 shadow-[0_8px_40px_rgba(9,30,66,0.12)]">
          <div className="text-center mb-8">
            <h2 className="text-[26px] font-extrabold text-[#172B4D] mb-1.5" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Welcome back
            </h2>
            <p className="text-sm text-[#6B778C]">Sign in to your governance account</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#172B4D] mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@abchealth.com"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                className={`w-full h-11 px-3.5 rounded-lg border bg-white focus:outline-none transition-shadow ${
                  emailError
                    ? "border-red-400 focus:ring-2 focus:ring-red-100"
                    : "border-slate-300 hover:border-slate-400 focus:border-[#0052CC] focus:ring-2 focus:ring-[#E6EFFC]"
                }`}
              />
              {emailError && <span className="text-red-500 text-xs mt-1.5 block">{emailError}</span>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-[#172B4D] mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  className={`w-full h-11 pl-3.5 pr-11 rounded-lg border bg-white focus:outline-none transition-shadow ${
                    passwordError
                      ? "border-red-400 focus:ring-2 focus:ring-red-100"
                      : "border-slate-300 hover:border-slate-400 focus:border-[#0052CC] focus:ring-2 focus:ring-[#E6EFFC]"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#97A0AF] hover:text-[#172B4D] p-1.5 rounded-md focus:outline-none transition-colors flex items-center justify-center"
                >
                  <span className="material-icons text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {passwordError && <span className="text-red-500 text-xs mt-1.5 block">{passwordError}</span>}
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-[#FFEBE6] border border-[#FFBDAD] rounded-lg text-[#BF2600] text-sm font-medium">
                <span className="material-icons text-[18px]">error_outline</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full h-11 bg-gradient-to-r from-[#0052CC] to-[#00B8D9] text-white rounded-lg font-semibold shadow-sm hover:opacity-95 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-icons animate-spin text-[18px]">autorenew</span>
                  Signing in...
                </>
              ) : (
                <>
                  <span className="material-icons text-[18px]">login</span>
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
