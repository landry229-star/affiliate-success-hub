// Server route: tracks the click then redirects to the affiliate URL
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/go/$productId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });

        const { data: product } = await supabase
          .from("products")
          .select("affiliate_url")
          .eq("id", params.productId)
          .maybeSingle();

        if (!product?.affiliate_url) {
          return new Response("Lien introuvable", { status: 404 });
        }

        // Fire-and-forget click insert
        const ua = request.headers.get("user-agent") ?? null;
        const referrer = request.headers.get("referer") ?? null;
        supabase.from("clicks").insert({ product_id: params.productId, user_agent: ua, referrer }).then(() => {});

        return new Response(null, {
          status: 302,
          headers: { Location: product.affiliate_url, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
