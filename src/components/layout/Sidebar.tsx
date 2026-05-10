"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FileScan,
  Receipt,
  Settings,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "דאשבורד",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "חשבוניות מייל",
    href: "/invoices",
    icon: FileText,
  },
  {
    label: "פיצול PDF",
    href: "/pdf-split",
    icon: FileScan,
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
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar border-l border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-sidebar-border">
        <Receipt className="h-8 w-8 text-primary ml-2" />
        <span className="text-xl font-bold text-sidebar-foreground">
          FinDash
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
              {isActive && (
                <ChevronRight className="h-4 w-4 mr-auto rotate-180" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/50 text-center">
          FinDash v1.0
        </p>
      </div>
    </aside>
  );
}
