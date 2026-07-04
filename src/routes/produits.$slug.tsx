import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard, type ProductCardItem } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Star, Check, X, ExternalLink } from "lucide-react";
import { formatPrice } from "@/lib/format";

const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data: product } = await supabase
        .from("products")
        .select("*, categories(name,slug)")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (!product) return null;
      const { data: similar } = await supabase
        .from("products")
        .select("id,name,slug,image_url,price,currency,rating,merchant")
        .eq("published", true)
        .eq("category_id", product.category_id ?? "")
        .neq("id", product.id)
        .limit(4);
      return { product, similar: (similar ?? []) as ProductCardItem[] };
    },
  });

export const Route = createFileRoute("/produits/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.name} — Test & avis | TopDeals` },
          { name: "description", content: loaderData.product.description?.slice(0, 155) ?? "Test et avis détaillé." },
          { property: "og:title", content: loaderData.product.name },
          { property: "og:description", content: loaderData.product.description?.slice(0, 155) ?? "" },
          ...(loaderData.product.image_url ? [{ property: "og:image", content: loaderData.product.image_url }] : []),
        ]
      : [{ title: "Produit introuvable" }],
  }),
  component: ProductDetail,
  notFoundComponent: () => (
    <SiteLayout>
      <div className="container-page py-20 text-center">
        <h1 className="text-3xl font-bold">Produit introuvable</h1>
        <Link to="/produits" className="text-accent underline mt-4 inline-block">Retour aux produits</Link>
      </div>
    </SiteLayout>
  ),
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(productQuery(slug));
  if (!data) return null;
  const { product, similar } = data;

  return (
    <SiteLayout
      chatProduct={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        image_url: product.image_url,
      }}
    >
      <div className="container-page py-10">
        <nav className="text-sm text-muted-foreground mb-6">
          <Link to="/produits" className="hover:text-foreground">Produits</Link>
          {product.categories && (
            <>
              {" / "}
              <Link to="/categories/$slug" params={{ slug: product.categories.slug }} className="hover:text-foreground">
                {product.categories.name}
              </Link>
            </>
          )}
          {" / "}<span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-10">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full aspect-square object-cover" />
            ) : (
              <div className="aspect-square grid place-items-center text-muted-foreground">Pas d'image</div>
            )}
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-bold">{product.name}</h1>
            <div className="mt-3 flex items-center gap-4">
              {product.rating != null && (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`h-4 w-4 ${i <= Math.round(Number(product.rating)) ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                  ))}
                  <span className="ml-1 text-sm text-muted-foreground">{Number(product.rating).toFixed(1)}/5</span>
                </div>
              )}
              {product.merchant && <span className="text-sm text-muted-foreground">chez {product.merchant}</span>}
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <div className="text-4xl font-bold">{formatPrice(Number(product.price), product.currency)}</div>
            </div>

            <p className="mt-5 text-muted-foreground leading-relaxed whitespace-pre-line">{product.description}</p>

            <a
              href={`/go/${product.id}`}
              target="_blank"
              rel="noopener nofollow sponsored"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-lg gradient-accent text-accent-foreground font-semibold px-6 py-3.5 hover:opacity-90 transition-opacity w-full md:w-auto"
            >
              Voir l'offre <ExternalLink className="h-4 w-4" />
            </a>
            <p className="mt-2 text-xs text-muted-foreground">Lien d'affiliation — sans surcoût pour vous.</p>

            {(product.pros?.length > 0 || product.cons?.length > 0) && (
              <div className="mt-8 grid sm:grid-cols-2 gap-4">
                {product.pros?.length > 0 && (
                  <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                    <div className="font-semibold text-success mb-2">Points forts</div>
                    <ul className="space-y-1.5 text-sm">
                      {product.pros.map((p: string, i: number) => (
                        <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0 mt-0.5" /><span>{p}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {product.cons?.length > 0 && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                    <div className="font-semibold text-destructive mb-2">Points faibles</div>
                    <ul className="space-y-1.5 text-sm">
                      {product.cons.map((p: string, i: number) => (
                        <li key={i} className="flex gap-2"><X className="h-4 w-4 text-destructive shrink-0 mt-0.5" /><span>{p}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold mb-6">Produits similaires</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {similar.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </SiteLayout>
  );
}
