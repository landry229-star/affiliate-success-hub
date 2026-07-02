import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, MousePointerClick, Package, Newspaper, TrendingUp, Calendar, Trophy, Users, AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ClickRow = { id: string; product_id: string | null; clicked_at: string; user_agent: string | null };

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function AdminStats() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-advanced-stats"],
    queryFn: async () => {
      const [clicksRes, productsRes, categoriesRes, postsRes] = await Promise.all([
        supabase.from("clicks").select("id, product_id, clicked_at, user_agent").order("clicked_at", { ascending: false }).limit(5000),
        supabase.from("products").select("id, name, price, currency, merchant, category_id, published, featured"),
        supabase.from("categories").select("id, name"),
        supabase.from("posts").select("id, published"),
      ]);
      const firstError = clicksRes.error ?? productsRes.error ?? categoriesRes.error ?? postsRes.error;
      if (firstError) throw new Error(firstError.message);
      return {
        clicks: (clicksRes.data ?? []) as ClickRow[],
        products: productsRes.data ?? [],
        categories: categoriesRes.data ?? [],
        posts: postsRes.data ?? [],
      };
    },
  });

  if (isLoading) return <StatsSkeleton />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-destructive/15 text-destructive grid place-items-center">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold">Impossible de charger les statistiques</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {error instanceof Error ? error.message : "Une erreur inattendue est survenue."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Réessayer
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const hasNoData = data.clicks.length === 0 && data.products.length === 0 && data.posts.length === 0;
  if (hasNoData) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 flex flex-col items-center text-center gap-3">
        <div className="h-14 w-14 rounded-full bg-muted text-muted-foreground grid place-items-center">
          <Inbox className="h-7 w-7" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold">Aucune donnée pour l'instant</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Ajoutez des produits et publiez du contenu pour commencer à collecter des clics et voir vos statistiques ici.
          </p>
        </div>
      </div>
    );
  }

  const now = Date.now();
  const DAY = 86_400_000;
  const clicks7d = data.clicks.filter((c) => now - new Date(c.clicked_at).getTime() <= 7 * DAY);
  const clicks30d = data.clicks.filter((c) => now - new Date(c.clicked_at).getTime() <= 30 * DAY);
  const clicksPrev7d = data.clicks.filter((c) => {
    const d = now - new Date(c.clicked_at).getTime();
    return d > 7 * DAY && d <= 14 * DAY;
  });
  const growth = clicksPrev7d.length === 0 ? (clicks7d.length > 0 ? 100 : 0) : Math.round(((clicks7d.length - clicksPrev7d.length) / clicksPrev7d.length) * 100);

  // Time series last 30 days
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const days: { date: string; label: string; clicks: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    days.push({ date: dayKey(d), label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }), clicks: 0 });
  }
  const dayMap = new Map(days.map((d) => [d.date, d]));
  clicks30d.forEach((c) => {
    const k = dayKey(new Date(c.clicked_at));
    const bucket = dayMap.get(k);
    if (bucket) bucket.clicks++;
  });

  // Top products
  const productsMap = new Map(data.products.map((p) => [p.id, p]));
  const perProduct = new Map<string, number>();
  data.clicks.forEach((c) => { if (c.product_id) perProduct.set(c.product_id, (perProduct.get(c.product_id) ?? 0) + 1); });
  const topProducts = Array.from(perProduct.entries())
    .map(([id, count]) => ({ id, count, product: productsMap.get(id) }))
    .filter((r) => r.product)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Per merchant
  const perMerchant = new Map<string, number>();
  data.clicks.forEach((c) => {
    if (!c.product_id) return;
    const m = productsMap.get(c.product_id)?.merchant ?? "Autre";
    perMerchant.set(m, (perMerchant.get(m) ?? 0) + 1);
  });
  const merchantData = Array.from(perMerchant.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  // Per category
  const categoryMap = new Map(data.categories.map((c) => [c.id, c.name]));
  const perCategory = new Map<string, number>();
  data.clicks.forEach((c) => {
    if (!c.product_id) return;
    const catId = productsMap.get(c.product_id)?.category_id;
    const catName = catId ? categoryMap.get(catId) ?? "Sans catégorie" : "Sans catégorie";
    perCategory.set(catName, (perCategory.get(catName) ?? 0) + 1);
  });
  const categoryData = Array.from(perCategory.entries()).map(([name, clicks]) => ({ name, clicks })).sort((a, b) => b.clicks - a.clicks);

  // Estimated revenue (assume 4% commission on price * clicks * 3% conversion rate)
  const estRevenue = topProducts.reduce((sum, r) => {
    const price = Number(r.product?.price ?? 0);
    return sum + price * r.count * 0.03 * 0.04;
  }, 0);

  const uniqueVisitors = new Set(data.clicks.map((c) => c.user_agent ?? "")).size;
  const publishedProducts = data.products.filter((p) => p.published).length;
  const publishedPosts = data.posts.filter((p) => p.published).length;

  return (
    <div className="space-y-8">
      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={MousePointerClick} label="Clics totaux" value={data.clicks.length.toLocaleString("fr-FR")} accent />
        <KpiCard
          icon={TrendingUp}
          label="Clics 7 derniers jours"
          value={clicks7d.length.toLocaleString("fr-FR")}
          trend={growth}
        />
        <KpiCard icon={Calendar} label="Clics 30 derniers jours" value={clicks30d.length.toLocaleString("fr-FR")} />
        <KpiCard icon={Users} label="Visiteurs uniques (approx.)" value={uniqueVisitors.toLocaleString("fr-FR")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Package} label="Produits publiés" value={`${publishedProducts} / ${data.products.length}`} muted />
        <KpiCard icon={Newspaper} label="Articles publiés" value={`${publishedPosts} / ${data.posts.length}`} muted />
        <KpiCard icon={Trophy} label="Top marchand" value={merchantData[0]?.name ?? "—"} muted />
        <KpiCard icon={BarChart3} label="Revenu estimé*" value={formatPrice(estRevenue, "EUR")} muted />
      </div>

      {/* Time series */}
      <Card title="Clics sur 30 jours" subtitle="Évolution quotidienne des clics affiliés">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={days} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
              />
              <Line type="monotone" dataKey="clicks" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#colorClicks)" dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top products chart */}
        <Card title="Top produits" subtitle="Classement par nombre de clics">
          {topProducts.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts.map((r) => ({ name: r.product!.name.slice(0, 24), clics: r.count }))} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} width={140} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="clics" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Merchant repartition */}
        <Card title="Répartition par marchand" subtitle="Part de clics par partenaire">
          {merchantData.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={merchantData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                    {merchantData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Category table */}
      <Card title="Performance par catégorie">
        {categoryData.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="divide-y divide-border">
            {categoryData.map((c) => {
              const pct = data.clicks.length === 0 ? 0 : Math.round((c.clicks / data.clicks.length) * 100);
              return (
                <div key={c.name} className="py-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">{c.name}</div>
                    <div className="tabular-nums text-muted-foreground">{c.clicks} clic{c.clicks > 1 ? "s" : ""} · {pct}%</div>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full gradient-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        * Revenu estimé sur base d'un taux de conversion moyen de 3% et d'une commission moyenne de 4%. Chiffres indicatifs.
      </p>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  trend,
  accent,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend?: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "border-accent/30 bg-gradient-to-br from-accent/10 to-transparent" : muted ? "border-border bg-card" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between">
        <div className={`h-9 w-9 rounded-lg grid place-items-center ${accent ? "gradient-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </div>
        {trend !== undefined && (
          <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${trend >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {trend >= 0 ? "+" : ""}{trend}%
          </div>
        )}
      </div>
      <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-1 text-2xl font-display font-bold tracking-tight">{value}</div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="h-72 grid place-items-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
      Pas encore assez de données pour afficher ce graphique.
    </div>
  );
}
