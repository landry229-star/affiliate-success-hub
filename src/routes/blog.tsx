import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";

const blogQuery = queryOptions({
  queryKey: ["blog-list"],
  queryFn: async () => {
    const { data } = await supabase
      .from("posts")
      .select("id,title,slug,excerpt,cover_url,published_at")
      .eq("published", true)
      .order("published_at", { ascending: false });
    return data ?? [];
  },
});

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — TopDeals" },
      { name: "description", content: "Guides d'achat, comparatifs et tests détaillés." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(blogQuery),
  component: BlogList,
});

function BlogList() {
  const { data } = useSuspenseQuery(blogQuery);
  return (
    <SiteLayout>
      <div className="container-page py-10">
        <h1 className="text-3xl md:text-4xl font-bold">Blog</h1>
        <p className="text-muted-foreground mt-2">Guides d'achat, comparatifs et tests.</p>

        {data.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Aucun article publié pour le moment.
          </div>
        ) : (
          <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((p) => (
              <Link key={p.id} to="/blog/$slug" params={{ slug: p.slug }} className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-[var(--shadow-card)] transition-all">
                {p.cover_url && <img src={p.cover_url} alt={p.title} loading="lazy" className="aspect-video w-full object-cover" />}
                <div className="p-5">
                  <h2 className="font-semibold leading-tight">{p.title}</h2>
                  {p.excerpt && <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>}
                  {p.published_at && <div className="mt-3 text-xs text-muted-foreground">{new Date(p.published_at).toLocaleDateString("fr-FR")}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
