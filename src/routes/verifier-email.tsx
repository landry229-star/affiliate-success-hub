import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  requestVerificationResend,
  getVerificationResendState,
} from "@/lib/verify-email.functions";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MailCheck, RefreshCw, LogOut, AlertTriangle } from "lucide-react";

type ConfirmError = { code: string; title: string; message: string };

function parseConfirmError(): ConfirmError | null {
  if (typeof window === "undefined") return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(
    window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash,
  );
  const get = (k: string) => search.get(k) ?? hash.get(k);
  const error = get("error");
  const code = get("error_code") ?? get("error");
  const description = get("error_description");
  if (!error && !code && !description) return null;

  const c = (code ?? "").toLowerCase();
  if (c.includes("otp_expired") || c.includes("expired")) {
    return {
      code: c,
      title: "Le lien de confirmation a expiré",
      message:
        "Ce lien de vérification n'est plus valable. Cliquez ci-dessous pour en recevoir un nouveau.",
    };
  }
  if (c.includes("access_denied")) {
    return {
      code: c,
      title: "Confirmation refusée",
      message:
        "Le lien a été refusé ou a déjà été utilisé. Demandez un nouvel email de vérification.",
    };
  }
  if (c.includes("invalid") || c.includes("bad_jwt") || c.includes("token")) {
    return {
      code: c,
      title: "Lien de confirmation invalide",
      message:
        "Ce lien n'est pas reconnu. Il a peut-être été tronqué par votre client mail. Renvoyez-en un nouveau.",
    };
  }
  return {
    code: c || "unknown",
    title: "La confirmation a échoué",
    message: description
      ? decodeURIComponent(description.replace(/\+/g, " "))
      : "Une erreur inattendue est survenue. Vous pouvez relancer la vérification ci-dessous.",
  };
}

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

function isConfirmed(user: {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  app_metadata?: { provider?: string };
} | null): boolean {
  if (!user) return false;
  return (
    Boolean(user.email_confirmed_at) ||
    Boolean(user.confirmed_at) ||
    user.app_metadata?.provider !== "email"
  );
}

function reasonToMessage(reason: string | undefined): string {
  switch (reason) {
    case "cooldown":
      return "Merci de patienter avant de renvoyer un email.";
    case "already_verified":
      return "Votre email est déjà vérifié.";
    case "provider_error":
      return "Le service email a refusé l'envoi. Réessayez plus tard.";
    case "network_error":
      return "Problème de connexion. Vérifiez votre réseau.";
    case "no_email":
      return "Aucune adresse email associée à votre compte.";
    default:
      return "Impossible d'envoyer l'email de vérification.";
  }
}

function VerifyEmailPage() {
  const navigate = useNavigate();
  const requestResend = useServerFn(requestVerificationResend);
  const getState = useServerFn(getVerificationResendState);
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const tickRef = useRef<number | null>(null);

  function startCountdown(seconds: number) {
    setSecondsLeft(seconds);
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (seconds <= 0) return;
    const until = Date.now() + seconds * 1000;
    tickRef.current = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0 && tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, []);

  // Load user + initial server-side cooldown state
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      const user = data.user;
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      if (isConfirmed(user)) {
        navigate({ to: "/admin" });
        return;
      }
      setEmail(user.email ?? null);
      try {
        const state = await getState();
        if (active && state.secondsLeft > 0) startCountdown(state.secondsLeft);
      } catch {
        /* ignore */
      }
    });
    return () => {
      active = false;
    };
  }, [navigate, getState]);

  // Auto-redirect on confirmation: listen for auth state + poll refresh every 5s
  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (isConfirmed(session?.user ?? null)) {
        toast.success("Email vérifié !");
        navigate({ to: "/admin" });
      }
    });

    const poll = window.setInterval(async () => {
      if (!active) return;
      const { data } = await supabase.auth.refreshSession();
      if (isConfirmed(data.user)) {
        toast.success("Email vérifié !");
        navigate({ to: "/admin" });
      }
    }, 5000);

    // Also refresh when the tab regains focus (user clicked link in another tab)
    const onFocus = async () => {
      const { data } = await supabase.auth.refreshSession();
      if (isConfirmed(data.user)) {
        toast.success("Email vérifié !");
        navigate({ to: "/admin" });
      }
    };
    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [navigate]);

  async function refresh() {
    setChecking(true);
    try {
      await supabase.auth.refreshSession();
      const { data } = await supabase.auth.getUser();
      if (isConfirmed(data.user)) {
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
    if (!email || secondsLeft > 0) return;
    setResending(true);
    try {
      const res = await requestResend();
      if (res.ok) {
        startCountdown(res.secondsLeft);
        toast.success("Email de vérification renvoyé. Vérifiez votre boîte mail.");
      } else {
        if (res.secondsLeft > 0) startCountdown(res.secondsLeft);
        toast.error(reasonToMessage(res.reason));
      }
    } catch {
      toast.error("Impossible de contacter le serveur. Réessayez.");
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
          Cette page se met à jour automatiquement dès la confirmation.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card p-5 space-y-3 text-sm">
          <p>
            Nous avons envoyé un lien de vérification à{" "}
            <span className="font-medium text-foreground">{email ?? "votre adresse"}</span>.
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>Ouvrez votre boîte mail (pensez au dossier Spam/Promotions).</li>
            <li>Cliquez sur le lien « Confirmer mon email ».</li>
            <li>Revenez sur cet onglet — vous serez redirigé automatiquement.</li>
          </ol>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <Button onClick={refresh} disabled={checking} className="flex-1">
            <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            J'ai vérifié
          </Button>
          <Button
            variant="outline"
            onClick={resend}
            disabled={resending || !email || secondsLeft > 0}
            className="flex-1"
          >
            {resending
              ? "Envoi..."
              : secondsLeft > 0
                ? `Renvoyer (${secondsLeft}s)`
                : "Renvoyer l'email"}
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
