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
      className="group rounded-xl border border-border bg-card overflow-hidden hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="aspect-[4/3] bg-muted overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">Pas d'image</div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight line-clamp-2">{product.name}</h3>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="font-bold text-lg">{formatPrice(product.price, product.currency)}</div>
          {product.rating != null && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              <span>{Number(product.rating).toFixed(1)}</span>
            </div>
          )}
        </div>
        {product.merchant && (
          <div className="mt-1 text-xs text-muted-foreground">chez {product.merchant}</div>
        )}
      </div>
    </Link>
  );
}
