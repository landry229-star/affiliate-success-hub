import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MailCheck, RefreshCw, LogOut } from "lucide-react";

export const Route = createFileRoute("/verifier-email")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vérifier votre email — TopDeals" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyEmailPage,
});

const COOLDOWN_KEY = "verify-email-resend";
const BASE_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;

function readCooldown(): { until: number; attempts: number } {
  if (typeof window === "undefined") return { until: 0, attempts: 0 };
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    if (!raw) return { until: 0, attempts: 0 };
    const parsed = JSON.parse(raw) as { until?: number; attempts?: number };
    return { until: parsed.until ?? 0, attempts: parsed.attempts ?? 0 };
  } catch {
    return { until: 0, attempts: 0 };
  }
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate") || m.includes("too many") || m.includes("limit")) {
    return "Trop de tentatives. Merci de patienter avant de réessayer.";
  }
  if (m.includes("already") && m.includes("confirm")) {
    return "Cet email est déjà vérifié. Reconnectez-vous.";
  }
  if (m.includes("not found") || m.includes("user")) {
    return "Utilisateur introuvable. Veuillez vous reconnecter.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Problème de connexion. Vérifiez votre réseau et réessayez.";
  }
  return "Impossible d'envoyer l'email de vérification. Réessayez plus tard.";
}

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const attemptsRef = useRef(0);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const user = data.user;
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      const confirmed =
        Boolean(user.email_confirmed_at) ||
        Boolean((user as { confirmed_at?: string | null }).confirmed_at) ||
        user.app_metadata?.provider !== "email";
      if (confirmed) {
        navigate({ to: "/admin" });
        return;
      }
      setEmail(user.email ?? null);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  // Init cooldown from storage + tick every second
  useEffect(() => {
    const { until, attempts } = readCooldown();
    attemptsRef.current = attempts;
    const compute = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSecondsLeft(left);
      return left;
    };
    if (compute() === 0) return;
    const id = window.setInterval(() => {
      if (compute() === 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  async function refresh() {
    setChecking(true);
    try {
      await supabase.auth.refreshSession();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      const confirmed =
        Boolean(user?.email_confirmed_at) ||
        Boolean((user as { confirmed_at?: string | null } | null)?.confirmed_at);
      if (confirmed) {
        toast.success("Email vérifié !");
        navigate({ to: "/admin" });
      } else {
        toast.info("Email pas encore vérifié. Pensez à cliquer sur le lien reçu.");
      }
    } finally {
      setChecking(false);
    }
  }

  async function resend() {
    if (!email) return;
    if (secondsLeft > 0) {
      toast.error(`Merci de patienter ${secondsLeft}s avant un nouvel envoi.`);
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/verifier-email" },
      });
      if (error) throw error;

      // Escalating cooldown: 60s, 120s, 240s, ... capped at 15min
      const attempts = attemptsRef.current + 1;
      attemptsRef.current = attempts;
      const wait = Math.min(BASE_COOLDOWN_MS * 2 ** (attempts - 1), MAX_COOLDOWN_MS);
      const until = Date.now() + wait;
      try {
        localStorage.setItem(COOLDOWN_KEY, JSON.stringify({ until, attempts }));
      } catch {
        /* ignore */
      }
      setSecondsLeft(Math.ceil(wait / 1000));
      const id = window.setInterval(() => {
        const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        setSecondsLeft(left);
        if (left === 0) window.clearInterval(id);
      }, 1000);

      toast.success("Email de vérification renvoyé. Vérifiez votre boîte mail.");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      toast.error(translateAuthError(raw));
    } finally {
      setResending(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <SiteLayout>
      <div className="container-page py-16 max-w-lg">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl gradient-accent mb-6">
          <MailCheck className="h-8 w-8 text-accent-foreground" />
        </div>
        <h1 className="text-3xl font-bold">Vérifiez votre adresse email</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          L'accès à l'espace admin est bloqué tant que votre email n'est pas vérifié.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card p-5 space-y-3 text-sm">
          <p>
            Nous avons envoyé un lien de vérification à{" "}
            <span className="font-medium text-foreground">{email ?? "votre adresse"}</span>.
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>Ouvrez votre boîte mail (pensez au dossier Spam/Promotions).</li>
            <li>Cliquez sur le lien « Confirmer mon email ».</li>
            <li>Revenez ici puis cliquez sur « J'ai vérifié ».</li>
          </ol>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <Button onClick={refresh} disabled={checking} className="flex-1">
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            J'ai vérifié
          </Button>
          <Button variant="outline" onClick={resend} disabled={resending || !email} className="flex-1">
            {resending ? "Envoi..." : "Renvoyer l'email"}
          </Button>
        </div>

        <div className="mt-8 flex items-center justify-between text-xs">
          <Link to="/" className="text-muted-foreground hover:underline">← Retour à l'accueil</Link>
          <button onClick={signOut} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <LogOut className="h-3 w-3" /> Se déconnecter
          </button>
        </div>
      </div>
    </SiteLayout>
  );
}
