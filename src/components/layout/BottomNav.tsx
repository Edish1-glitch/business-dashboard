"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Plus, Clock, Settings } from "lucide-react";
import { usePendingCount } from "@/components/providers/PendingCountProvider";
import { cn } from "@/lib/utils";

interface NavItem { href: string; label: string; icon: React.ElementType; exact?: boolean; badge?: boolean }

const side: NavItem[] = [
  { href: "/", label: "בית", icon: Home, exact: true },
  { href: "/invoices", label: "חשבוניות", icon: FileText, exact: true },
];
const side2: NavItem[] = [
  { href: "/invoices/pending", label: "ממתינות", icon: Clock, badge: true },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

/**
 * Mobile-only floating glass tab bar (matches the mockup): a rounded glass pill
 * with a raised gradient + FAB in the centre linking to upload.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { pendingCount } = usePendingCount();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav
      className="md:hidden fixed inset-x-4 z-40 h-[62px] rounded-[26px] glass-nav flex items-center justify-between px-6"
      style={{ bottom: "max(0.5rem, calc(env(safe-area-inset-bottom) - 0.75rem))" }}
    >
      {side.map((it) => (
        <NavLink key={it.href} {...it} active={isActive(it.href, it.exact)} />
      ))}

      <Link
        href="/upload"
        aria-label="העלאת חשבונית"
        className="-mt-8 w-[54px] h-[54px] rounded-[20px] flex items-center justify-center text-white shrink-0"
        style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", boxShadow: "0 12px 26px rgba(124,58,237,.45)" }}
      >
        <Plus className="h-6 w-6" strokeWidth={2.6} />
      </Link>

      {side2.map((it) => (
        <NavLink key={it.href} {...it} active={isActive(it.href, it.exact)} badgeCount={it.badge ? pendingCount : 0} />
      ))}
    </nav>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badgeCount = 0,
}: NavItem & { active: boolean; badgeCount?: number }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-col items-center gap-1 text-[9.5px] font-semibold min-w-[44px]",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      {badgeCount > 0 && (
        <span className="absolute -top-1 left-1 z-10 min-w-[16px] h-[15px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 2} />
      {label}
    </Link>
  );
}
