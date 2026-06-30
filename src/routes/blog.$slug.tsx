import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";

const postQuery = (slug: string) =>
  queryOptions({
    queryKey: ["post", slug],
    queryFn: async () => {
      const { data } = await supabase.from("posts").select("*").eq("slug", slug).eq("published", true).maybeSingle();
      return data;
    },
  });

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(postQuery(params.slug));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} — TopDeals` },
          { name: "description", content: loaderData.excerpt ?? loaderData.title },
          { property: "og:title", content: loaderData.title },
          { property: "og:description", content: loaderData.excerpt ?? "" },
          ...(loaderData.cover_url ? [{ property: "og:image", content: loaderData.cover_url }] : []),
        ]
      : [{ title: "Article" }],
  }),
  component: PostPage,
  notFoundComponent: () => (
    <SiteLayout>
      <div className="container-page py-20 text-center">
        <h1 className="text-3xl font-bold">Article introuvable</h1>
        <Link to="/blog" className="text-accent underline mt-4 inline-block">Retour au blog</Link>
      </div>
    </SiteLayout>
  ),
});

function PostPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(postQuery(slug));
  if (!data) return null;
  return (
    <SiteLayout>
      <article className="container-page py-10 max-w-3xl">
        {data.cover_url && <img src={data.cover_url} alt={data.title} className="rounded-2xl mb-8 w-full" />}
        <h1 className="text-3xl md:text-5xl font-bold leading-tight">{data.title}</h1>
        {data.published_at && <div className="mt-3 text-sm text-muted-foreground">Publié le {new Date(data.published_at).toLocaleDateString("fr-FR")}</div>}
        <div className="mt-8 prose-content whitespace-pre-line text-foreground/90 leading-relaxed text-lg">
          {data.content}
        </div>
      </article>
    </SiteLayout>
  );
}
