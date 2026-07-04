import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag, LayoutDashboard, Package, FolderTree, Newspaper, BarChart3, ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export type AdminSection = "overview" | "products" | "categories" | "posts" | "stats" | "chat";

const NAV: { key: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { key: "products", label: "Produits", icon: Package },
  { key: "categories", label: "Catégories", icon: FolderTree },
  { key: "posts", label: "Articles", icon: Newspaper },
  { key: "chat", label: "Messages", icon: MessageCircle },
  { key: "stats", label: "Statistiques", icon: BarChart3 },
];

export function AdminShell({
  active,
  onChange,
  title,
  subtitle,
  unreadChat = 0,
  children,
}: {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  title: string;
  subtitle?: string;
  unreadChat?: number;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="grid md:grid-cols-[240px_1fr] min-h-screen">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col border-r border-border bg-card">
          <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg gradient-accent">
              <ShoppingBag className="h-4 w-4 text-accent-foreground" />
            </span>
            <div>
              <div className="font-display font-bold text-sm leading-tight">TopDeals</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Admin</div>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              const isActive = active === n.key;
              const badge = n.key === "chat" && unreadChat > 0 ? unreadChat : 0;
              return (
                <button
                  key={n.key}
                  onClick={() => onChange(n.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{n.label}</span>
                  {badge > 0 && (
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <div className="p-3 border-t border-border space-y-2">
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link to="/"><ArrowLeft className="h-3.5 w-3.5 mr-2" />Retour au site</Link>
            </Button>
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}>
              Déconnexion
            </Button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex flex-col min-w-0">
          {/* Mobile top bar */}
          <div className="md:hidden h-14 border-b border-border bg-card flex items-center justify-between px-4">
            <Link to="/" className="text-sm font-semibold flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Site</Link>
            <div className="font-display font-bold text-sm">Admin</div>
          </div>
          <div className="md:hidden border-b border-border bg-card px-2 py-2 flex gap-1 overflow-x-auto">
            {NAV.map((n) => {
              const Icon = n.icon;
              const isActive = active === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => onChange(n.key)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground bg-muted"}`}
                >
                  <Icon className="h-3.5 w-3.5" />{n.label}
                </button>
              );
            })}
          </div>

          <header className="border-b border-border bg-card">
            <div className="px-6 md:px-10 py-6">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
            </div>
          </header>

          <main className="flex-1 px-4 md:px-10 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
