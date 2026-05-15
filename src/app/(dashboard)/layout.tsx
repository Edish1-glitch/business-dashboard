import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Onboarding } from "@/components/Onboarding";
import { SyncFloatingWidget } from "@/components/SyncFloatingWidget";
import { Toaster } from "sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />
      <div className="md:mr-64 min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8">{children}</main>
      </div>
      <SyncFloatingWidget />
      <Onboarding />
      <Toaster position="top-center" dir="rtl" richColors />
    </>
  );
}
