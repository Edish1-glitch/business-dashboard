"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
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

  return (
    <header className="sticky top-0 z-40 flex items-center h-16 px-4 md:px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      {/* Mobile menu */}
      <Sheet>
        <SheetPrimitive.Trigger
          render={
            <Button variant="ghost" size="icon" className="md:hidden ml-2" />
          }
        >
          <Menu className="h-5 w-5" />
        </SheetPrimitive.Trigger>
        <SheetContent side="right" className="w-64 p-0">
          <SheetTitle className="sr-only">תפריט ניווט</SheetTitle>
          <div className="flex items-center h-16 px-6 border-b border-border">
            <Receipt className="h-8 w-8 text-primary ml-2" />
            <span className="text-xl font-bold">FinDash</span>
          </div>
          <nav className="px-3 py-4 space-y-1">
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
          </nav>
        </SheetContent>
      </Sheet>

      {/* Page title */}
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
