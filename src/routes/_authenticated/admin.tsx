import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShieldAlert } from "lucide-react";
import { slugify, formatPrice } from "@/lib/format";
import { AdminShell, type AdminSection } from "@/components/admin/AdminShell";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminStats } from "@/components/admin/AdminStats";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — TopDeals" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

function useIsAdmin() {
  const [state, setState] = useState<{ loading: boolean; isAdmin: boolean; userId: string | null }>({ loading: true, isAdmin: false, userId: null });
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;
      if (!userId) { setState({ loading: false, isAdmin: false, userId: null }); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      setState({ loading: false, isAdmin: !!data, userId });
    })();
  }, []);
  return state;
}

const SECTION_META: Record<AdminSection, { title: string; subtitle: string }> = {
  overview: { title: "Vue d'ensemble", subtitle: "L'état de votre site en un coup d'œil." },
  products: { title: "Produits", subtitle: "Gérez votre catalogue affilié." },
  categories: { title: "Catégories", subtitle: "Organisez vos produits par thème." },
  posts: { title: "Articles", subtitle: "Publiez du contenu pour attirer du trafic." },
  stats: { title: "Statistiques", subtitle: "Analysez vos performances d'affiliation." },
};

function Admin() {
  const { loading, isAdmin, userId } = useIsAdmin();
  const [section, setSection] = useState<AdminSection>("overview");

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Chargement...</div>;
  if (!isAdmin) return <NoAdminAccess userId={userId} />;

  const meta = SECTION_META[section];
  return (
    <AdminShell active={section} onChange={setSection} title={meta.title} subtitle={meta.subtitle}>
      {section === "overview" && <AdminOverview onNavigate={setSection} />}
      {section === "products" && <ProductsAdmin />}
      {section === "categories" && <CategoriesAdmin />}
      {section === "posts" && <PostsAdmin />}
      {section === "stats" && <AdminStats />}
    </AdminShell>
  );
}

function NoAdminAccess({ userId }: { userId: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 grid place-items-center text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Accès admin requis</h1>
        <p className="mt-2 text-muted-foreground">Votre compte n'a pas le rôle <code>admin</code>.</p>
        {userId && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5 text-left text-sm">
            <p className="font-medium">Exécutez cette requête SQL une seule fois :</p>
            <pre className="mt-3 bg-muted rounded-md p-3 text-xs overflow-auto">{`INSERT INTO public.user_roles (user_id, role)\nVALUES ('${userId}', 'admin');`}</pre>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => { navigator.clipboard.writeText(`INSERT INTO public.user_roles (user_id, role) VALUES ('${userId}', 'admin');`); setCopied(true); setTimeout(()=>setCopied(false), 2000); }}>
              {copied ? "Copié !" : "Copier"}
            </Button>
          </div>
        )}
        <div className="mt-6">
          <Link to="/" className="text-accent hover:underline">← Retour à l'accueil</Link>
        </div>
      </div>
    </div>
  );
}


/* ============ PRODUCTS ============ */

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  price: number | null;
  currency: string;
  rating: number | null;
  pros: string[];
  cons: string[];
  affiliate_url: string;
  merchant: string | null;
  category_id: string | null;
  featured: boolean;
  published: boolean;
};

function ProductsAdmin() {
  const qc = useQueryClient();
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      return (data ?? []) as ProductRow[];
    },
  });
  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await supabase.from("categories").select("id,name").order("name")).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Produit supprimé"); qc.invalidateQueries({ queryKey: ["admin-products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Produits ({products?.length ?? 0})</h2>
        <ProductDialog categories={categories ?? []} />
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="p-3">Nom</th>
              <th className="p-3">Prix</th>
              <th className="p-3">Note</th>
              <th className="p-3">Vedette</th>
              <th className="p-3">Publié</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">{formatPrice(p.price, p.currency)}</td>
                <td className="p-3">{p.rating ?? "—"}</td>
                <td className="p-3">{p.featured ? "★" : ""}</td>
                <td className="p-3">{p.published ? "✓" : "—"}</td>
                <td className="p-3 flex gap-2 justify-end">
                  <ProductDialog product={p} categories={categories ?? []} />
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Supprimer "${p.name}" ?`)) del.mutate(p.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {(products?.length ?? 0) === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Aucun produit. Cliquez sur "Ajouter".</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductDialog({ product, categories }: { product?: ProductRow; categories: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<ProductRow>>(product ?? {
    name: "", slug: "", description: "", image_url: "", price: null, currency: "EUR",
    rating: null, pros: [], cons: [], affiliate_url: "", merchant: "", category_id: null, featured: false, published: true,
  });
  const [prosText, setProsText] = useState((product?.pros ?? []).join("\n"));
  const [consText, setConsText] = useState((product?.cons ?? []).join("\n"));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name!,
        slug: form.slug || slugify(form.name ?? ""),
        description: form.description ?? "",
        image_url: form.image_url || null,
        price: form.price != null ? Number(form.price) : null,
        currency: form.currency || "EUR",
        rating: form.rating != null && form.rating !== ("" as unknown as number) ? Number(form.rating) : null,
        pros: prosText.split("\n").map((s) => s.trim()).filter(Boolean),
        cons: consText.split("\n").map((s) => s.trim()).filter(Boolean),
        affiliate_url: form.affiliate_url!,
        merchant: form.merchant || null,
        category_id: form.category_id || null,
        featured: !!form.featured,
        published: form.published !== false,
      };
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(product ? "Produit mis à jour" : "Produit créé"); setOpen(false); qc.invalidateQueries({ queryKey: ["admin-products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {product ? (
          <Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button><Plus className="h-4 w-4 mr-1" />Ajouter</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? "Modifier le produit" : "Nouveau produit"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div><Label>Nom</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} /></div>
          <div><Label>Slug (URL)</Label><Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={4} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Image (URL)</Label><Input value={form.image_url ?? ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Prix</Label><Input type="number" step="0.01" value={form.price ?? ""} onChange={(e) => setForm({ ...form, price: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div><Label>Devise</Label><Input value={form.currency ?? "EUR"} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
            <div><Label>Note (0-5)</Label><Input type="number" step="0.1" min="0" max="5" value={form.rating ?? ""} onChange={(e) => setForm({ ...form, rating: e.target.value === "" ? null : Number(e.target.value) })} /></div>
          </div>
          <div><Label>Marchand</Label><Input value={form.merchant ?? ""} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="Amazon, Cdiscount..." /></div>
          <div>
            <Label>Lien d'affiliation</Label>
            <Input value={form.affiliate_url ?? ""} onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })} placeholder="https://amzn.to/..." />
          </div>
          <div>
            <Label>Catégorie</Label>
            <Select value={form.category_id ?? "none"} onValueChange={(v) => setForm({ ...form, category_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Points forts (un par ligne)</Label><Textarea rows={4} value={prosText} onChange={(e) => setProsText(e.target.value)} /></div>
            <div><Label>Points faibles (un par ligne)</Label><Textarea rows={4} value={consText} onChange={(e) => setConsText(e.target.value)} /></div>
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2"><Switch checked={!!form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} /><Label>Mis en avant</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.published !== false} onCheckedChange={(v) => setForm({ ...form, published: v })} /><Label>Publié</Label></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.affiliate_url}>{save.isPending ? "..." : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ CATEGORIES ============ */

function CategoriesAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-categories-full"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categories").insert({ name, slug: slugify(name), description: description || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Catégorie créée"); setName(""); setDescription(""); qc.invalidateQueries({ queryKey: ["admin-categories-full"] }); qc.invalidateQueries({ queryKey: ["admin-categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Supprimée"); qc.invalidateQueries({ queryKey: ["admin-categories-full"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h3 className="font-semibold mb-3">Ajouter une catégorie</h3>
        <div className="space-y-3">
          <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>Créer</Button>
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-3">Catégories existantes</h3>
        <div className="rounded-xl border border-border divide-y divide-border">
          {(data ?? []).map((c) => (
            <div key={c.id} className="p-3 flex items-center justify-between">
              <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">/{c.slug}</div></div>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Supprimer "${c.name}" ?`)) del.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {(data?.length ?? 0) === 0 && <div className="p-4 text-sm text-muted-foreground text-center">Aucune catégorie.</div>}
        </div>
      </div>
    </div>
  );
}

/* ============ POSTS ============ */

type PostRow = {
  id: string; title: string; slug: string; excerpt: string | null; content: string; cover_url: string | null;
  published: boolean; published_at: string | null;
};

function PostsAdmin() {
  const qc = useQueryClient();
  const { data: posts } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => (await supabase.from("posts").select("*").order("created_at", { ascending: false })).data as PostRow[] | null,
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("posts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["admin-posts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Articles ({posts?.length ?? 0})</h2>
        <PostDialog />
      </div>
      <div className="rounded-xl border border-border divide-y divide-border">
        {(posts ?? []).map((p) => (
          <div key={p.id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium truncate">{p.title}</div>
              <div className="text-xs text-muted-foreground">{p.published ? "Publié" : "Brouillon"} · /{p.slug}</div>
            </div>
            <div className="flex gap-2">
              <PostDialog post={p} />
              <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Supprimer "${p.title}" ?`)) del.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {(posts?.length ?? 0) === 0 && <div className="p-6 text-sm text-muted-foreground text-center">Aucun article.</div>}
      </div>
    </div>
  );
}

function PostDialog({ post }: { post?: PostRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<PostRow>>(post ?? { title: "", slug: "", excerpt: "", content: "", cover_url: "", published: false });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title!, slug: form.slug || slugify(form.title ?? ""),
        excerpt: form.excerpt || null, content: form.content ?? "",
        cover_url: form.cover_url || null, published: !!form.published,
        published_at: form.published ? (post?.published_at ?? new Date().toISOString()) : null,
      };
      if (post) {
        const { error } = await supabase.from("posts").update(payload).eq("id", post.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("posts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(post ? "Article mis à jour" : "Article créé"); setOpen(false); qc.invalidateQueries({ queryKey: ["admin-posts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{post ? <Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button> : <Button><Plus className="h-4 w-4 mr-1" />Nouvel article</Button>}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{post ? "Modifier l'article" : "Nouvel article"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div><Label>Titre</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value, slug: form.slug || slugify(e.target.value) })} /></div>
          <div><Label>Slug</Label><Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
          <div><Label>Image de couverture (URL)</Label><Input value={form.cover_url ?? ""} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></div>
          <div><Label>Extrait</Label><Textarea rows={2} value={form.excerpt ?? ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></div>
          <div><Label>Contenu</Label><Textarea rows={12} value={form.content ?? ""} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          <div className="flex items-center gap-2"><Switch checked={!!form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} /><Label>Publié</Label></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>{save.isPending ? "..." : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============ STATS ============ */

function StatsAdmin() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data: clicks } = await supabase.from("clicks").select("product_id, clicked_at");
      const { data: products } = await supabase.from("products").select("id, name");
      const productsMap = new Map((products ?? []).map((p) => [p.id, p.name]));
      const counts = new Map<string, number>();
      (clicks ?? []).forEach((c) => {
        if (!c.product_id) return;
        counts.set(c.product_id, (counts.get(c.product_id) ?? 0) + 1);
      });
      const rows = Array.from(counts.entries())
        .map(([id, count]) => ({ id, name: productsMap.get(id) ?? "(supprimé)", count }))
        .sort((a, b) => b.count - a.count);
      return { total: clicks?.length ?? 0, rows };
    },
  });

  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-accent/15 grid place-items-center text-accent"><BarChart3 className="h-5 w-5" /></div>
        <div>
          <div className="text-sm text-muted-foreground">Clics totaux sur liens affiliés</div>
          <div className="text-2xl font-bold">{data?.total ?? 0}</div>
        </div>
      </div>
      <h3 className="font-semibold mt-8 mb-3">Top produits</h3>
      <div className="rounded-xl border border-border divide-y divide-border">
        {(data?.rows ?? []).map((r) => (
          <div key={r.id} className="p-3 flex items-center justify-between">
            <div className="font-medium">{r.name}</div>
            <div className="text-sm tabular-nums">{r.count} clic{r.count > 1 ? "s" : ""}</div>
          </div>
        ))}
        {(data?.rows.length ?? 0) === 0 && <div className="p-6 text-sm text-muted-foreground text-center">Pas encore de clics enregistrés.</div>}
      </div>
    </div>
  );
}
