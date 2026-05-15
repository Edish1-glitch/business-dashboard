"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Tag, User, Plus, Loader2, X, Play, Mail, RefreshCw, Trash2, Calendar } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface EmailAccount {
  id: string;
  email: string;
  provider: string;
  lastSyncAt: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [loading, setLoading] = useState(true);

  // Email accounts
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState("");
  const [syncPercent, setSyncPercent] = useState(0);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncDate, setSyncDate] = useState("2024-01-01");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Gmail connection status from URL
  const gmailStatus = searchParams.get("gmail");

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => { setCategories(d.categories || []); setLoading(false); })
      .catch(() => setLoading(false));

    fetch("/api/email-accounts")
      .then((r) => r.json())
      .then((d) => { setEmailAccounts(d.accounts || []); setLoadingEmails(false); })
      .catch(() => setLoadingEmails(false));
  }, []);

  // Show toast-like message for Gmail connection status
  useEffect(() => {
    if (gmailStatus) {
      // Clean the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("gmail");
      window.history.replaceState({}, "", url.toString());

      if (gmailStatus === "connected") {
        // Refresh email accounts
        fetch("/api/email-accounts")
          .then((r) => r.json())
          .then((d) => setEmailAccounts(d.accounts || []));
      }
    }
  }, [gmailStatus]);

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`האם למחוק את הקטגוריה "${name}"? חשבוניות שמשויכות אליה יישארו ללא קטגוריה.`)) return;
    const res = await fetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    const data = await res.json();
    if (data.category) {
      setCategories((prev) => [...prev, data.category]);
      setNewCatName("");
    }
  };

  const disconnectEmail = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/email-accounts/${id}`, { method: "DELETE" });
    setEmailAccounts((prev) => prev.filter((a) => a.id !== id));
    setDeletingId(null);
  };

  const syncEmails = async (accountId?: string) => {
    setSyncingId(accountId || "all");
    setSyncProgress("מתחיל סנכרון...");
    setSyncPercent(0);
    setSyncResult(null);

    try {
      const body: Record<string, string> = { afterDate: syncDate };
      if (accountId) body.accountId = accountId;

      const response = await fetch("/api/email-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        setSyncResult(data.error || "שגיאה בסנכרון");
        setSyncingId(null);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === "progress") {
                setSyncProgress(msg.message);
                setSyncPercent(msg.total > 0 ? (msg.current / msg.total) * 100 : 0);
              } else if (msg.type === "done") {
                setSyncResult(msg.message);
                // Refresh accounts to update lastSyncAt
                fetch("/api/email-accounts")
                  .then((r) => r.json())
                  .then((d) => setEmailAccounts(d.accounts || []));
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch {
      setSyncResult("שגיאה בסנכרון");
    } finally {
      setSyncingId(null);
      setSyncProgress("");
      setSyncPercent(0);
    }
  };

  return (
    <div data-tour="settings" className="space-y-8 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold">הגדרות</h2>

      {/* Gmail status notification */}
      {gmailStatus === "connected" && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm">
          חשבון Gmail חובר בהצלחה!
        </div>
      )}
      {gmailStatus === "denied" && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm">
          הגישה ל-Gmail נדחתה. נסה שוב.
        </div>
      )}
      {(gmailStatus === "error" || gmailStatus === "expired") && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-800 text-sm">
          שגיאה בחיבור Gmail. נסה שוב.
        </div>
      )}

      {/* Profile */}
      <div className="rounded-2xl bg-card border border-border/50 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <User className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">פרופיל</h3>
        </div>
        {session?.user && (
          <div className="flex items-center gap-4">
            {session.user.image && (
              <img
                src={session.user.image}
                alt=""
                className="w-14 h-14 rounded-full"
                referrerPolicy="no-referrer"
              />
            )}
            <div>
              <p className="font-medium">{session.user.name}</p>
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
        )}
      </div>

      {/* Email Accounts */}
      <div className="rounded-2xl bg-card border border-border/50 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">חשבונות אימייל</h3>
          </div>
          <a href="/api/email-accounts/connect">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              חבר Gmail
            </Button>
          </a>
        </div>

        {loadingEmails ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        ) : emailAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            אין חשבונות אימייל מחוברים. חבר חשבון Gmail כדי למשוך חשבוניות אוטומטית.
          </p>
        ) : (
          <div className="space-y-3">
            {emailAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{account.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.lastSyncAt
                      ? `סנכרון אחרון: ${new Date(account.lastSyncAt).toLocaleDateString("he-IL")}`
                      : "טרם סונכרן"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => syncEmails(account.id)}
                    disabled={!!syncingId}
                  >
                    {syncingId === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => disconnectEmail(account.id)}
                    disabled={deletingId === account.id}
                  >
                    {deletingId === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}

            {/* Sync controls */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <label className="text-xs text-muted-foreground shrink-0">סנכרן מתאריך:</label>
                  <input
                    type="date"
                    value={syncDate}
                    onChange={(e) => setSyncDate(e.target.value)}
                    className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => syncEmails()}
                  disabled={!!syncingId}
                  className="gap-2"
                >
                  {syncingId === "all" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  סנכרן הכל
                </Button>
              </div>

              {/* Progress bar */}
              {syncingId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">{syncProgress}</span>
                    {syncPercent > 0 && (
                      <span className="font-medium text-xs">{Math.round(syncPercent)}%</span>
                    )}
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(syncPercent, 2)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Sync result */}
              {syncResult && (
                <div className="rounded-xl bg-muted/50 p-3 text-sm whitespace-pre-line">
                  {syncResult}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="rounded-2xl bg-card border border-border/50 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <Tag className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">קטגוריות</h3>
        </div>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((cat) => (
                <span
                  key={cat.id}
                  className="group flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-muted"
                  style={{ borderRight: `3px solid ${cat.color || "#9ca3af"}` }}
                >
                  {cat.name}
                  <button
                    onClick={() => deleteCategory(cat.id, cat.name)}
                    className="hidden group-hover:inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                    title="מחק קטגוריה"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="שם קטגוריה חדשה"
                className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm"
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
              />
              <Button size="sm" onClick={addCategory} className="gap-1">
                <Plus className="h-4 w-4" />
                הוסף
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Tour */}
      <div className="rounded-2xl bg-card border border-border/50 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">סיור באפליקציה</h3>
            <p className="text-sm text-muted-foreground">מדריך אינטראקטיבי שמציג את כל הפיצ׳רים</p>
          </div>
          <Button onClick={() => router.push("/tour")} className="gap-2">
            <Play className="h-4 w-4" />
            התחל סיור
          </Button>
        </div>
      </div>

      {/* App info */}
      <div className="rounded-2xl bg-card border border-border/50 p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">FinDash v1.0 - ניהול חשבוניות והוצאות</p>
      </div>
    </div>
  );
}
