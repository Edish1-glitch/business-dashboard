"use client";

import { useState, useEffect, useCallback } from "react";
import { Menu, X } from "lucide-react";
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
  { label: "דאשבורד", href: "/", icon: LayoutDashboard },
  { label: "חשבוניות מייל", href: "/invoices", icon: FileText },
  { label: "פיצול PDF", href: "/pdf-split", icon: FileScan },
  { label: "חשבונית ירוקה", href: "/green-invoice", icon: Receipt },
  { label: "הגדרות", href: "/settings", icon: Settings },
];

const pageTitles: Record<string, string> = {
  "/": "דאשבורד",
  "/invoices": "חשבוניות מייל",
  "/pdf-split": "פיצול PDF",
  "/green-invoice": "חשבונית ירוקה",
  "/settings": "הגדרות",
};

export function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "FinDash";
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Close on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center h-16 px-4 md:px-6 bg-background border-b border-border">
        {/* Mobile menu button */}
        <button
          type="button"
          className="md:hidden ml-2 flex items-center justify-center h-11 w-11 rounded-lg hover:bg-accent active:bg-accent/80 transition-colors -webkit-tap-highlight-color-transparent"
          onClick={() => setOpen(true)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          aria-label="פתח תפריט"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Page title */}
        <h1 className="text-lg font-semibold">{title}</h1>
      </header>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40"
            onClick={close}
            onTouchEnd={(e) => {
              e.preventDefault();
              close();
            }}
          />

          {/* Sidebar panel */}
          <nav className="fixed inset-y-0 right-0 w-64 bg-background shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-border">
              <div className="flex items-center">
                <Receipt className="h-8 w-8 text-primary ml-2" />
                <span className="text-xl font-bold">FinDash</span>
              </div>
              <button
                type="button"
                className="flex items-center justify-center h-11 w-11 rounded-lg hover:bg-accent active:bg-accent/80"
                onClick={close}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  close();
                }}
                aria-label="סגור תפריט"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav items */}
            <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground/70 hover:bg-accent/50 hover:text-foreground"
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
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
