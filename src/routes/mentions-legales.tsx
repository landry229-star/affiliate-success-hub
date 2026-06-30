import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — TopDeals" },
      { name: "description", content: "Mentions légales et informations sur l'affiliation." },
    ],
  }),
  component: Legal,
});

function Legal() {
  return (
    <SiteLayout>
      <div className="container-page py-12 max-w-3xl space-y-6 text-muted-foreground leading-relaxed">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">Mentions légales</h1>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Éditeur du site</h2>
          <p>TopDeals — [À compléter : nom, adresse, contact de l'éditeur].</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Hébergement</h2>
          <p>Le site est hébergé sur l'infrastructure Lovable.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Liens d'affiliation</h2>
          <p>
            TopDeals participe à des programmes d'affiliation (notamment Amazon Partenaires, Awin, etc.). Certains
            liens présents sur ce site sont des liens affiliés : lorsque vous achetez un produit après avoir cliqué
            sur un de ces liens, nous percevons une commission. Cela ne change rien au prix que vous payez et nous
            permet de financer le contenu du site. Nos recommandations restent toujours indépendantes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground">Propriété intellectuelle</h2>
          <p>Tous les contenus du site (textes, images, marques) sont protégés. Toute reproduction est interdite sans autorisation.</p>
        </section>
      </div>
    </SiteLayout>
  );
}
