import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Menu, X } from "lucide-react";

export function Header() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [userId]);

  const links = [
    { to: "/produits", label: "Produits" },
    { to: "/blog", label: "Blog" },
    { to: "/a-propos", label: "À propos" },
    { to: "/contact", label: "Contact" },
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg gradient-accent">
            <ShoppingBag className="h-4 w-4 text-accent-foreground" />
          </span>
          <span>TopDeals</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "px-3 py-2 text-sm font-medium text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Admin</Link>
            </Button>
          )}
          {!userId ? (
            <Button asChild size="sm">
              <Link to="/auth">Connexion</Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); }}>
              Déconnexion
            </Button>
          )}
        </div>

        <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border">
          <div className="container-page py-3 flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="px-3 py-2 rounded-md hover:bg-muted" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            {isAdmin && <Link to="/admin" className="px-3 py-2 rounded-md hover:bg-muted" onClick={() => setOpen(false)}>Admin</Link>}
            {!userId ? (
              <Link to="/auth" className="px-3 py-2 rounded-md hover:bg-muted" onClick={() => setOpen(false)}>Connexion</Link>
            ) : (
              <button className="text-left px-3 py-2 rounded-md hover:bg-muted" onClick={async () => { await supabase.auth.signOut(); setOpen(false); }}>Déconnexion</button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
