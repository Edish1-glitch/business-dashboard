"use client";

import { useState } from "react";
import { LogOut, Monitor, Sun, Moon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, string> = {
  "/": "דאשבורד",
  "/upload": "העלאת חשבוניות",
  "/invoices/pending": "ממתינות לאישור",
  "/invoices/deleted": "נמחקו לאחרונה",
  "/invoices": "חשבוניות",
  "/green-invoice": "חשבונית ירוקה",
  "/settings": "הגדרות",
};

export function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "FinDash";
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  return (
    <header
      className="glass-header sticky top-0 z-40 flex items-center px-4 md:px-6"
      style={{ height: "calc(4rem + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)" }}
    >
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>

      {/* User info + actions — pushed to the left. Mobile navigation lives in the bottom nav. */}
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
            <NotificationBell />
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
  );
}
