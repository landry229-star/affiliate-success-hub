import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const [{ data: products }, { data: posts }, { data: cats }] = await Promise.all([
          supabase.from("products").select("slug, updated_at").eq("published", true),
          supabase.from("posts").select("slug, updated_at").eq("published", true),
          supabase.from("categories").select("slug"),
        ]);

        const entries: { path: string; lastmod?: string }[] = [
          { path: "/" },
          { path: "/produits" },
          { path: "/blog" },
          { path: "/a-propos" },
          { path: "/contact" },
          { path: "/mentions-legales" },
          ...(cats ?? []).map((c) => ({ path: `/categories/${c.slug}` })),
          ...(products ?? []).map((p) => ({ path: `/produits/${p.slug}`, lastmod: p.updated_at })),
          ...(posts ?? []).map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.updated_at })),
        ];

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...entries.map((e) =>
            `  <url><loc>${BASE_URL}${e.path}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}</url>`,
          ),
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
