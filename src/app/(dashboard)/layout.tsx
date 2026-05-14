import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

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
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </>
  );
}
