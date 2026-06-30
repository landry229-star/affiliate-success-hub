import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard, type ProductCardItem } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, ShieldCheck, TrendingUp } from "lucide-react";
import heroImg from "@/assets/hero.jpg";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    const [featured, categories, latestPosts] = await Promise.all([
      supabase.from("products").select("id,name,slug,image_url,price,currency,rating,merchant").eq("published", true).eq("featured", true).limit(6),
      supabase.from("categories").select("id,name,slug,icon").order("name"),
      supabase.from("posts").select("id,title,slug,excerpt,cover_url,published_at").eq("published", true).order("published_at", { ascending: false }).limit(3),
    ]);
    return {
      featured: (featured.data ?? []) as ProductCardItem[],
      categories: categories.data ?? [],
      posts: latestPosts.data ?? [],
    };
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TopDeals — Comparatifs et bons plans high-tech" },
      { name: "description", content: "Les meilleurs produits high-tech, testés et comparés. Trouvez le bon produit au meilleur prix." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(homeQuery);
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_oklch(0.72_0.18_60_/_0.35),_transparent_60%)]" />
        <div className="container-page relative py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
          <div className="text-primary-foreground">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Sélection mise à jour chaque semaine</span>
            </div>
            <h1 className="mt-5 text-4xl md:text-6xl font-bold leading-[1.05]">
              Le meilleur du <span className="text-accent">high-tech</span>, testé et comparé.
            </h1>
            <p className="mt-5 text-lg text-white/80 max-w-lg">
              Évitez les mauvais achats. On teste les produits, on compare les prix, et on vous montre ce qui en vaut vraiment la peine.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/produits">Découvrir les produits <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <Link to="/blog">Lire le blog</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <img src={heroImg} alt="Sélection de produits high-tech" className="rounded-2xl shadow-2xl" />
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="container-page py-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: ShieldCheck, title: "Tests indépendants", desc: "Avis honnêtes, pas de bullshit." },
          { icon: TrendingUp, title: "Mis à jour en continu", desc: "Les prix bougent, on suit." },
          { icon: Sparkles, title: "Sélection rigoureuse", desc: "Seulement ce qui mérite votre argent." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-accent/15 grid place-items-center text-accent">
              <f.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.desc}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Categories */}
      {data.categories.length > 0 && (
        <section className="container-page py-12">
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold">Catégories</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {data.categories.map((c) => (
              <Link
                key={c.id}
                to="/categories/$slug"
                params={{ slug: c.slug }}
                className="rounded-xl border border-border bg-card p-5 hover:border-accent hover:shadow-[var(--shadow-card)] transition-all text-center"
              >
                <div className="font-semibold">{c.name}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      <section className="container-page py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Nos coups de cœur</h2>
            <p className="text-muted-foreground mt-1">Les produits qu'on recommande sans hésiter.</p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/produits">Tout voir <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        {data.featured.length === 0 ? (
          <EmptyHint message="Aucun produit mis en avant pour le moment. Connectez-vous en admin pour ajouter vos premiers produits." />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {data.featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      {/* Latest posts */}
      {data.posts.length > 0 && (
        <section className="container-page py-12">
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-2xl md:text-3xl font-bold">Derniers articles</h2>
            <Button asChild variant="ghost">
              <Link to="/blog">Tout le blog <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {data.posts.map((p) => (
              <Link key={p.id} to="/blog/$slug" params={{ slug: p.slug }} className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-[var(--shadow-card)] transition-all">
                {p.cover_url && <img src={p.cover_url} alt={p.title} loading="lazy" className="aspect-video w-full object-cover" />}
                <div className="p-5">
                  <h3 className="font-semibold leading-tight">{p.title}</h3>
                  {p.excerpt && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </SiteLayout>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
      {message}
    </div>
  );
}
