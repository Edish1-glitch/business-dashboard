import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { LiquidBackground } from "@/components/layout/LiquidBackground";
import { Onboarding } from "@/components/Onboarding";
import { SyncFloatingWidget } from "@/components/SyncFloatingWidget";
import { UploadFloatingWidget } from "@/components/UploadFloatingWidget";
import { Toaster } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LiquidBackground />
      <Sidebar />
      <div className="md:mr-64 min-h-screen flex flex-col">
        <Header />
        {/* pb-24 clears the mobile bottom tab bar */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 pb-24 md:pb-8">{children}</main>
      </div>
      <SyncFloatingWidget />
      <UploadFloatingWidget />
      <BottomNav />
      <Onboarding />
      <Toaster position="top-center" dir="rtl" richColors />
    </>
  );
}
