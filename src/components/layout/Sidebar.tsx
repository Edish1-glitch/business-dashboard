"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FileScan,
  Receipt,
  Settings,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "דאשבורד",
    href: "/",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "העלאת חשבוניות",
    href: "/upload",
    icon: FileScan,
  },
  {
    label: "ממתינות לאישור",
    href: "/invoices/pending",
    icon: ClipboardCheck,
  },
  {
    label: "חשבוניות",
    href: "/invoices",
    icon: FileText,
    exact: true,
  },
  {
    label: "חשבונית ירוקה",
    href: "/green-invoice",
    icon: Receipt,
  },
  {
    label: "הגדרות",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 h-16 px-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sidebar-primary/20">
          <Receipt className="h-5 w-5 text-sidebar-primary" />
        </div>
        <span className="text-xl font-bold text-sidebar-foreground tracking-tight">
          FinDash
        </span>
      </div>

      {/* Section label */}
      <div className="px-6 pt-4 pb-2">
        <p className="text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
          ניווט ראשי
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 mx-3 mb-3 rounded-xl bg-sidebar-accent/50">
        <p className="text-xs text-sidebar-foreground/40 text-center">
          FinDash v1.0
        </p>
      </div>
    </aside>
  );
}
