"use client";

import { useEffect, useId, useState } from "react";
import { Menu, X, LogOut, Monitor } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Sun, Moon } from "lucide-react";
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
  { label: "דאשבורד", href: "/", icon: LayoutDashboard, exact: true },
  { label: "העלאת חשבוניות", href: "/upload", icon: FileScan },
  { label: "ממתינות לאישור", href: "/invoices/pending", icon: ClipboardCheck },
  { label: "חשבוניות", href: "/invoices", icon: FileText, exact: true },
  { label: "חשבונית ירוקה", href: "/green-invoice", icon: Receipt },
  { label: "הגדרות", href: "/settings", icon: Settings },
];

const pageTitles: Record<string, string> = {
  "/": "דאשבורד",
  "/upload": "העלאת חשבוניות",
  "/invoices/pending": "ממתינות לאישור",
  "/invoices": "חשבוניות",
  "/green-invoice": "חשבונית ירוקה",
  "/settings": "הגדרות",
};

export function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "FinDash";
  const checkboxId = useId();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Close menu on route change
  useEffect(() => {
    const checkbox = document.getElementById(checkboxId) as HTMLInputElement;
    if (checkbox) checkbox.checked = false;
  }, [pathname, checkboxId]);

  // Lock body scroll when menu open
  useEffect(() => {
    const checkbox = document.getElementById(checkboxId) as HTMLInputElement;
    if (!checkbox) return;
    const handler = () => {
      document.body.style.overflow = checkbox.checked ? "hidden" : "";
    };
    checkbox.addEventListener("change", handler);
    return () => {
      checkbox.removeEventListener("change", handler);
      document.body.style.overflow = "";
    };
  }, [checkboxId]);

  return (
    <>
      {/* Checkbox controls the menu - NO JavaScript needed for toggle (Safari-proof) */}
      <input
        type="checkbox"
        id={checkboxId}
        className="peer sr-only"
      />

      <header className="sticky top-0 z-40 flex items-center h-16 px-4 md:px-6 bg-background/80 backdrop-blur-xl border-b border-border/50">
        {/* <label> for native touch handling - Safari always responds to label taps */}
        <label
          htmlFor={checkboxId}
          className="md:hidden ml-3 flex items-center justify-center w-11 h-11 rounded-xl hover:bg-accent active:bg-accent/80"
          style={{ cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
          aria-label="פתח תפריט"
          role="button"
        >
          <Menu className="h-5 w-5 pointer-events-none" />
        </label>

        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>

        {/* User info + logout - pushed to left side */}
        <div className="mr-auto flex items-center gap-3">
          {session?.user && (
            <>
              <div className="hidden md:flex items-center gap-2">
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt=""
                    className="w-8 h-8 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className="text-sm text-muted-foreground">
                  {session.user.name?.split(" ")[0]}
                </span>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowThemeMenu(!showThemeMenu)}
                  className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="מצב תצוגה"
                >
                  {theme === "dark" ? <Moon className="h-4 w-4" /> : theme === "light" ? <Sun className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                </button>
                {showThemeMenu && (
                  <>
                    <div className="fixed inset-0 z-50" onClick={() => setShowThemeMenu(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
                      {[
                        { value: "light" as const, label: "בהיר", icon: Sun },
                        { value: "dark" as const, label: "כהה", icon: Moon },
                        { value: "system" as const, label: "מערכת", icon: Monitor },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setTheme(opt.value); setShowThemeMenu(false); }}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors",
                            theme === opt.value && "text-primary font-medium"
                          )}
                        >
                          <opt.icon className="h-4 w-4" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="התנתק"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Backdrop - direct sibling of checkbox so peer-checked works */}
      <label
        htmlFor={checkboxId}
        className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 opacity-0 pointer-events-none peer-checked:opacity-100 peer-checked:pointer-events-auto md:hidden"
        style={{ cursor: "pointer", touchAction: "manipulation" }}
      />

      {/* Sidebar - direct sibling of checkbox so peer-checked works */}
      <nav
        className="fixed inset-y-0 right-0 z-50 w-72 bg-sidebar shadow-2xl flex flex-col translate-x-full peer-checked:translate-x-0 transition-transform duration-200 md:hidden"
        role="dialog"
      >
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sidebar-primary/20">
              <Receipt className="h-5 w-5 text-sidebar-primary pointer-events-none" />
            </div>
            <span className="text-xl font-bold text-sidebar-foreground">FinDash</span>
          </div>
          <label
            htmlFor={checkboxId}
            className="flex items-center justify-center w-11 h-11 rounded-xl active:bg-sidebar-accent"
            style={{ cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
            aria-label="סגור תפריט"
            role="button"
          >
            <X className="h-5 w-5 text-sidebar-foreground/60 pointer-events-none" />
          </label>
        </div>

        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
            ניווט ראשי
          </p>
        </div>

        <div className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  const cb = document.getElementById(checkboxId) as HTMLInputElement;
                  if (cb) cb.checked = false;
                  document.body.style.overflow = "";
                }}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 min-h-[44px]",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/25"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0 pointer-events-none" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
