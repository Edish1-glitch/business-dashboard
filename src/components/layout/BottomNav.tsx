"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Upload, Clock, Settings } from "lucide-react";
import { usePendingCount } from "@/components/providers/PendingCountProvider";
import { cn } from "@/lib/utils";

interface NavItem { href: string; label: string; icon: React.ElementType; exact?: boolean; badge?: boolean }

const items: NavItem[] = [
  { href: "/", label: "בית", icon: Home, exact: true },
  { href: "/invoices", label: "חשבוניות", icon: FileText, exact: true },
  { href: "/upload", label: "העלאה", icon: Upload },
  { href: "/invoices/pending", label: "ממתינות", icon: Clock, badge: true },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

/**
 * Mobile-only bottom tab bar — a flat, grounded bar (not a floating pill).
 * Five uniform tabs with comfortable tap targets. Desktop keeps the sidebar.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { pendingCount } = usePendingCount();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-background/85 backdrop-blur-xl border-t border-border/60 flex items-stretch justify-around"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((it) => {
        const active = isActive(it.href, it.exact);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "relative flex-1 flex flex-col items-center justify-center gap-1 pt-2.5 pb-2.5 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
            <span className="relative">
              <it.icon className="h-[23px] w-[23px]" strokeWidth={active ? 2.4 : 1.9} />
              {it.badge && pendingCount > 0 && (
                <span className="absolute -top-1.5 -left-2 min-w-[16px] h-[15px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
