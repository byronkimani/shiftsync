import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

export function AppShell() {
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Desktop sidebar */}
            <Sidebar />

            {/* Main content area */}
            <div className="flex-1 md:ml-64 flex flex-col min-w-0">
                <main className="flex-1 pb-20 md:pb-0 min-h-screen">
                    <Outlet />
                </main>
            </div>

            {/* Mobile bottom nav */}
            <BottomNav />
        </div>
    );
}
