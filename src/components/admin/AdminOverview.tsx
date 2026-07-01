import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Newspaper, FolderTree, MousePointerClick, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminSection } from "./AdminShell";

export function AdminOverview({ onNavigate }: { onNavigate: (s: AdminSection) => void }) {
  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [products, posts, categories, clicks] = await Promise.all([
        supabase.from("products").select("id, published, featured"),
        supabase.from("posts").select("id, published"),
        supabase.from("categories").select("id"),
        supabase.from("clicks").select("id, clicked_at").order("clicked_at", { ascending: false }).limit(2000),
      ]);
      const now = Date.now();
      const DAY = 86_400_000;
      const clicks24h = (clicks.data ?? []).filter((c) => now - new Date(c.clicked_at).getTime() <= DAY).length;
      return {
        products: products.data ?? [],
        posts: posts.data ?? [],
        categories: categories.data ?? [],
        clicksTotal: clicks.data?.length ?? 0,
        clicks24h,
      };
    },
  });

  if (!data) return <div className="text-sm text-muted-foreground">Chargement…</div>;

  const stats = [
    { key: "products", icon: Package, label: "Produits", value: data.products.length, hint: `${data.products.filter((p) => p.published).length} publiés` },
    { key: "posts", icon: Newspaper, label: "Articles", value: data.posts.length, hint: `${data.posts.filter((p) => p.published).length} publiés` },
    { key: "categories", icon: FolderTree, label: "Catégories", value: data.categories.length, hint: "Organisation" },
    { key: "stats", icon: MousePointerClick, label: "Clics affiliés", value: data.clicksTotal, hint: `${data.clicks24h} sur 24h` },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.key}
            onClick={() => onNavigate(s.key as AdminSection)}
            className="text-left rounded-2xl border border-border bg-card p-5 hover:border-accent/50 hover:shadow-[var(--shadow-card)] transition-all"
          >
            <div className="h-9 w-9 rounded-lg bg-accent/15 text-accent grid place-items-center"><s.icon className="h-4 w-4" /></div>
            <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">{s.label}</div>
            <div className="mt-1 text-3xl font-display font-bold">{s.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display font-semibold text-lg">Actions rapides</h2>
          <p className="text-sm text-muted-foreground mt-1">Alimentez votre catalogue et publiez du contenu.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => onNavigate("products")}>Ajouter un produit <ArrowRight className="ml-1 h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => onNavigate("posts")}>Écrire un article</Button>
            <Button variant="outline" onClick={() => onNavigate("categories")}>Créer une catégorie</Button>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-accent/10 p-6">
          <h2 className="font-display font-semibold text-lg">Astuce croissance</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Un produit avec au moins <strong className="text-foreground">3 points forts</strong>, une <strong className="text-foreground">note ≥ 4.0</strong> et une <strong className="text-foreground">image de qualité</strong> convertit jusqu'à 2× mieux. Marquez vos meilleurs produits comme « vedette » pour les mettre en une.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => onNavigate("stats")}>Voir les statistiques</Button>
        </div>
      </div>
    </div>
  );
}
