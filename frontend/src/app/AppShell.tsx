import { Outlet } from "react-router";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";

export function AppShell() {
  return (
    <div className="flex h-screen w-full bg-enterprise-bg overflow-hidden text-gray-800 font-sans selection:bg-enterprise-primary selection:text-white">
      <Sidebar />
      <div className="flex flex-col flex-1 relative overflow-hidden transition-all duration-300 relative">
        <Header />
        <main className="flex-1 overflow-y-auto w-full custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
