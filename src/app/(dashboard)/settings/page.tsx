"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Tag, User, Plus, Loader2, X, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Category {
  id: string;
  name: string;
  color: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => { setCategories(d.categories || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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

  return (
    <div data-tour="settings" className="space-y-8 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold">הגדרות</h2>

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
