import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos — TopDeals" },
      { name: "description", content: "Découvrez la philosophie et la méthode de TopDeals." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <SiteLayout>
      <div className="container-page py-12 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold">À propos de TopDeals</h1>
        <div className="mt-6 space-y-5 text-muted-foreground leading-relaxed">
          <p>
            TopDeals est un site indépendant dédié aux produits high-tech. Notre mission est simple : vous aider à
            faire les meilleurs choix sans perdre des heures à comparer.
          </p>
          <p>
            Nous testons, comparons et sélectionnons rigoureusement les produits que nous recommandons. Pas de fausses
            promesses, pas de classements bidons. Si on ne le prendrait pas pour nous, on ne vous le recommande pas.
          </p>
          <h2 className="text-xl font-semibold text-foreground pt-4">Comment on gagne notre vie ?</h2>
          <p>
            Quand vous achetez un produit via nos liens, nous touchons une petite commission de la part du marchand —
            sans surcoût pour vous. C'est ce qui finance le site et nous permet de rester indépendants.
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}
