import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard, type ProductCardItem } from "@/components/ProductCard";

const listQuery = queryOptions({
  queryKey: ["products-list"],
  queryFn: async () => {
    const [products, cats] = await Promise.all([
      supabase.from("products").select("id,name,slug,image_url,price,currency,rating,merchant,category_id").eq("published", true).order("created_at", { ascending: false }),
      supabase.from("categories").select("id,name,slug").order("name"),
    ]);
    return {
      products: (products.data ?? []) as (ProductCardItem & { category_id: string | null })[],
      categories: cats.data ?? [],
    };
  },
});

export const Route = createFileRoute("/produits")({
  head: () => ({
    meta: [
      { title: "Tous les produits — TopDeals" },
      { name: "description", content: "Parcourez notre sélection complète de produits high-tech testés." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(listQuery),
  component: ProductsList,
});

function ProductsList() {
  const { data } = useSuspenseQuery(listQuery);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<"recent" | "price-asc" | "price-desc" | "rating">("recent");

  let items = data.products.filter((p) => !category || p.category_id === category);
  items = [...items].sort((a, b) => {
    if (sort === "price-asc") return (a.price ?? Infinity) - (b.price ?? Infinity);
    if (sort === "price-desc") return (b.price ?? 0) - (a.price ?? 0);
    if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    return 0;
  });

  return (
    <SiteLayout>
      <div className="container-page py-10">
        <h1 className="text-3xl md:text-4xl font-bold">Tous les produits</h1>
        <p className="text-muted-foreground mt-2">{data.products.length} produits sélectionnés</p>

        <div className="mt-6 flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm border ${!category ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            Toutes
          </button>
          {data.categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm border ${category === c.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              {c.name}
            </button>
          ))}
          <div className="ml-auto">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="px-3 py-1.5 rounded-md border border-border bg-background text-sm"
            >
              <option value="recent">Plus récents</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
              <option value="rating">Mieux notés</option>
            </select>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Aucun produit pour le moment. <Link to="/admin" className="underline">Ajoutez-en depuis l'admin.</Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
