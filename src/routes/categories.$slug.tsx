import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard, type ProductCardItem } from "@/components/ProductCard";

const catQuery = (slug: string) =>
  queryOptions({
    queryKey: ["category", slug],
    queryFn: async () => {
      const { data: cat } = await supabase.from("categories").select("*").eq("slug", slug).maybeSingle();
      if (!cat) return null;
      const { data: products } = await supabase
        .from("products")
        .select("id,name,slug,image_url,price,currency,rating,merchant")
        .eq("published", true)
        .eq("category_id", cat.id)
        .order("featured", { ascending: false });
      return { category: cat, products: (products ?? []) as ProductCardItem[] };
    },
  });

export const Route = createFileRoute("/categories/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(catQuery(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.category.name} — TopDeals` },
          { name: "description", content: loaderData.category.description ?? `Tous les meilleurs produits ${loaderData.category.name}.` },
        ]
      : [{ title: "Catégorie" }],
  }),
  component: CategoryPage,
  notFoundComponent: () => (
    <SiteLayout>
      <div className="container-page py-20 text-center">
        <h1 className="text-3xl font-bold">Catégorie introuvable</h1>
        <Link to="/produits" className="text-accent underline mt-4 inline-block">Voir tous les produits</Link>
      </div>
    </SiteLayout>
  ),
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(catQuery(slug));
  if (!data) return null;
  return (
    <SiteLayout>
      <div className="container-page py-10">
        <h1 className="text-3xl md:text-4xl font-bold">{data.category.name}</h1>
        {data.category.description && <p className="text-muted-foreground mt-2">{data.category.description}</p>}

        {data.products.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Aucun produit dans cette catégorie pour le moment.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {data.products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
