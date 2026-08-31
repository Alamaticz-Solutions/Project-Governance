import { Outlet } from "react-router";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";

export function AppShell() {
  return (
    <div className="flex h-screen w-full bg-enterprise-bg overflow-hidden text-slate-800 font-sans selection:bg-indigo-600 selection:text-white">
      <Sidebar />
      <div className="flex flex-col flex-1 relative overflow-hidden transition-all duration-300">
        <Header />
        <main className="flex-1 overflow-y-auto w-full custom-scrollbar p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
