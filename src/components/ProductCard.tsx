import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { formatPrice } from "@/lib/format";

export type ProductCardItem = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  price: number | null;
  currency: string;
  rating: number | null;
  merchant?: string | null;
};

export function ProductCard({ product }: { product: ProductCardItem }) {
  return (
    <Link
      to="/produits/$slug"
      params={{ slug: product.slug }}
      className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:shadow-[var(--shadow-elevated)] hover:-translate-y-1 hover:border-accent/40 transition-all duration-300"
    >
      <div className="aspect-[4/3] bg-muted overflow-hidden relative">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">Pas d'image</div>
        )}
        {product.merchant && (
          <div className="absolute top-3 left-3 rounded-full bg-background/90 backdrop-blur px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider border border-border/50">
            {product.merchant}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold leading-snug line-clamp-2 min-h-[2.6rem]">{product.name}</h3>
        <div className="mt-3 flex items-center justify-between">
          <div className="font-display font-bold text-xl tracking-tight">{formatPrice(product.price, product.currency)}</div>
          {product.rating != null && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              <span className="font-medium">{Number(product.rating).toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
