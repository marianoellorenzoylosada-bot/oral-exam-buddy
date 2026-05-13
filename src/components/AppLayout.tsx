import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { OfflineBanner } from "@/components/OfflineBanner";

const COPYRIGHT_TEXT = "© 2026 Int'l Oral Exam Assistant. Evaluation methodology and AI results are subject to teacher supervision.";

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <OfflineBanner />
          <header className="flex h-14 items-center gap-4 border-b px-6">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <Outlet />
          </main>
          <footer className="border-t px-6 py-3 text-center text-xs text-muted-foreground print:block">
            {COPYRIGHT_TEXT}
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
