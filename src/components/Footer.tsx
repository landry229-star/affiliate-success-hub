import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border mt-24 bg-muted/30">
      <div className="container-page py-12 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="font-bold text-base mb-3">TopDeals</div>
          <p className="text-muted-foreground">
            Les meilleurs produits high-tech, testés et comparés pour vous.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-3">Navigation</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/produits" className="hover:text-foreground">Tous les produits</Link></li>
            <li><Link to="/blog" className="hover:text-foreground">Blog</Link></li>
            <li><Link to="/a-propos" className="hover:text-foreground">À propos</Link></li>
            <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Légal</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/mentions-legales" className="hover:text-foreground">Mentions légales</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Affiliation</div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            En tant que partenaire affilié, nous percevons une commission sur les achats qualifiés via nos liens, sans surcoût pour vous.
          </p>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page py-4 text-xs text-muted-foreground flex flex-wrap justify-between gap-2">
          <div>© {new Date().getFullYear()} TopDeals. Tous droits réservés.</div>
          <div>Fait avec ❤️</div>
        </div>
      </div>
    </footer>
  );
}
