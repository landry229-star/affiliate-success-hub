import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — TopDeals" },
      { name: "description", content: "Contactez l'équipe TopDeals." },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <SiteLayout>
      <div className="container-page py-12 max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold">Contact</h1>
        <p className="mt-3 text-muted-foreground">
          Une question, une suggestion, un partenariat ? Écrivez-nous, on lit tout.
        </p>
        <div className="mt-8 rounded-xl border border-border bg-card p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-accent/15 grid place-items-center text-accent">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">Email</div>
            <a href="mailto:contact@topdeals.example" className="text-accent hover:underline">contact@topdeals.example</a>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
