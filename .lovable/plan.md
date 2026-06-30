# Plan : Site d'affiliation "TopDeals" 🎯

## Recommandations (puisque tu m'as laissé choisir)

**Niche : High-tech / Gadgets** — c'est la niche d'affiliation la plus rentable pour débuter (volume de recherche élevé, commissions correctes, large catalogue Amazon).

**Type : Hybride Comparateur + Blog de reviews** — meilleur combo SEO + conversion :
- Pages produit avec note, prix, pros/cons, bouton "Acheter" (lien affilié)
- Articles de comparatifs ("Top 10 écouteurs sans-fil 2026")
- Tracking des clics pour mesurer ce qui convertit

**Programmes recommandés** (tu peux t'inscrire gratuitement) :
1. **Amazon Partenaires** — le plus simple, énorme catalogue, ~3-8% de commission
2. **Awin** — accès à Cdiscount, Fnac, Boulanger, etc. (5-12%)
3. **Rakuten Advertising** — Apple, Sephora, etc.
4. (Plus tard) **Impact / CJ Affiliate** pour les marques US

Tu n'as qu'à coller tes liens affiliés dans l'admin, le site fait le reste.

## Ce que je construis

### Pages publiques
- **Accueil** : hero, produits vedettes, catégories, derniers articles
- **/produits** : grille filtrable (catégorie, prix, note)
- **/produits/$slug** : fiche détaillée + bouton affilié + produits similaires
- **/categories/$slug** : produits par catégorie
- **/blog** : liste d'articles
- **/blog/$slug** : article avec produits intégrés
- **/a-propos** + **/contact** + mentions légales (obligatoire pour l'affiliation)

### Espace admin (`/admin`, protégé)
- Connexion email/password + Google
- CRUD produits (nom, image, prix, note, description, pros/cons, **lien affilié**, catégorie)
- CRUD catégories
- CRUD articles de blog (éditeur Markdown)
- Dashboard : nombre de clics par produit (tracking)

### Backend (Lovable Cloud)
Tables :
- `categories` (id, name, slug, icon)
- `products` (id, name, slug, description, image_url, price, rating, pros[], cons[], affiliate_url, category_id, featured)
- `posts` (articles blog : title, slug, excerpt, content_md, cover_url, published_at)
- `clicks` (tracking : product_id, clicked_at, user_agent) — pour mesurer la performance
- `user_roles` (sécurité admin via fonction `has_role`)

Les liens affiliés passent par une route `/go/$productId` qui enregistre le clic puis redirige → tu sauras exactement quels produits convertissent.

## Détails techniques

- TanStack Start + Tailwind + shadcn
- Lovable Cloud (Supabase) pour auth + DB + RLS
- Rôle `admin` stocké dans `user_roles` (jamais sur le profil) — sécurité
- Server functions pour les écritures, route publique pour lectures
- SEO : meta tags uniques par produit/article, sitemap.xml, OG images
- Design propre, sombre/clair, orienté conversion (boutons CTA visibles)

## Ce que tu devras faire après
1. Te connecter à Amazon Partenaires / Awin (je te guiderai)
2. Créer ton compte admin sur le site
3. Ajouter tes premiers produits avec tes liens affiliés
4. Optionnel : domaine custom

OK pour que je lance la construction ?
