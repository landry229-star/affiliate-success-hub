import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Package, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRecaptcha, useRecaptchaEnabled } from "@/hooks/useRecaptcha";
import { verifyRecaptchaToken } from "@/lib/recaptcha.functions";

const LS_KEY = "td_chat_sessions_v2"; // { [productId | "_general"]: { id, name } }
const CLIENT_COOLDOWN_MS = 2500;

export type ChatProduct = {
  id: string;
  name: string;
  slug: string;
  image_url?: string | null;
};

type Msg = {
  id: string;
  session_id: string;
  sender: "visitor" | "admin";
  content: string;
  created_at: string;
};

type Store = Record<string, { id: string; name?: string }>;

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function saveStore(store: Store) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function ChatWidget({ product }: { product?: ChatProduct | null }) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [visitorName, setVisitorName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [honeypot, setHoneypot] = useState(""); // spam trap — real users leave empty
  const lastSentRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const recaptchaEnabled = useRecaptchaEnabled();
  const { token: captchaToken, reset: resetCaptcha } = useRecaptcha(captchaRef, recaptchaEnabled && open);
  const verifyCaptcha = useServerFn(verifyRecaptchaToken);

  const productKey = product?.id ?? null;

  // Load session for current product from localStorage whenever product changes
  useEffect(() => {
    const store = loadStore();
    const key = productKey ?? "_general";
    const entry = store[key];
    setSessionId(entry?.id ?? null);
    setVisitorName(entry?.name ?? "");
    setMessages([]);
    setInput("");
  }, [productKey]);

  // Load messages when session exists
  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (mounted) {
        if (!error && data) setMessages(data as Msg[]);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  // Realtime
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`chat-visitor-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender === "admin" && !open) {
            toast.info("Nouveau message du support", { description: m.content.slice(0, 80) });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    if (!product) {
      toast.error("Ouvrez d'abord un produit pour démarrer une discussion.");
      return null;
    }
    const name = nameDraft.trim() || "Visiteur";
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        visitor_name: name,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
        product_id: product.id,
        product_context: product.name,
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Impossible d'ouvrir la conversation");
      return null;
    }
    setSessionId(data.id);
    setVisitorName(name);
    const store = loadStore();
    store[product.id] = { id: data.id, name };
    saveStore(store);
    return data.id;
  }

  function mapServerError(msg: string | undefined): string {
    const m = (msg ?? "").toLowerCase();
    if (m.includes("patienter")) return "Attendez quelques secondes avant d'envoyer un autre message.";
    if (m.includes("trop de messages")) return "Trop de messages envoyés. Réessayez dans une minute.";
    if (m.includes("limite horaire")) return "Vous avez atteint la limite horaire de messages.";
    if (m.includes("trop long")) return "Votre message est trop long (max 2000 caractères).";
    if (m.includes("vide")) return "Le message est vide.";
    return "Envoi impossible. Réessayez.";
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    if (!product) {
      toast.error("Ouvrez un produit pour discuter de cet article.");
      return;
    }

    // Honeypot — bot filled the hidden field
    if (honeypot) {
      setInput("");
      return;
    }

    // Client cooldown to avoid double-clicks / spammy bursts
    const now = Date.now();
    if (now - lastSentRef.current < CLIENT_COOLDOWN_MS) {
      toast.error("Attendez un instant avant d'envoyer un autre message.");
      return;
    }

    // Optional reCAPTCHA
    if (recaptchaEnabled) {
      if (!captchaToken) {
        toast.error("Merci de valider le reCAPTCHA avant d'envoyer.");
        return;
      }
      try {
        const result = await verifyCaptcha({ data: { token: captchaToken } });
        if (!result.ok) {
          toast.error("Vérification anti-robot échouée. Réessayez.");
          resetCaptcha();
          return;
        }
      } catch {
        toast.error("Impossible de vérifier le reCAPTCHA.");
        return;
      }
    }

    setSending(true);
    const sid = await ensureSession();
    if (!sid) {
      setSending(false);
      return;
    }
    const { error } = await supabase
      .from("chat_messages")
      .insert({ session_id: sid, sender: "visitor", content: text });
    if (error) {
      toast.error(mapServerError(error.message));
      setSending(false);
      return;
    }
    lastSentRef.current = Date.now();
    await supabase
      .from("chat_sessions")
      .update({
        last_message_at: new Date().toISOString(),
        unread_admin: messages.filter((m) => m.sender === "visitor").length + 1,
      })
      .eq("id", sid);
    setInput("");
    resetCaptcha();
    setSending(false);
  }

  const noProduct = !product;
  const needsName = !sessionId && !nameDraft.trim();

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le chat"
          className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full gradient-accent text-accent-foreground shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm h-[70vh] max-h-[560px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border gradient-accent text-accent-foreground">
            <div>
              <div className="font-display font-semibold text-sm">Support TopDeals</div>
              <div className="text-[11px] opacity-90">
                {product ? `À propos de ce produit` : "Ouvrez un produit pour discuter"}
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="p-1 rounded hover:bg-black/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Product banner */}
          {product && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40">
              <div className="h-9 w-9 rounded-md bg-background border border-border overflow-hidden shrink-0 grid place-items-center">
                {product.image_url ? (
                  <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Discussion sur</div>
                <div className="text-xs font-semibold truncate">{product.name}</div>
              </div>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-muted/20">
            {noProduct && (
              <div className="text-sm text-muted-foreground py-8 text-center px-4">
                <Package className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>Pour discuter avec le support, ouvrez d'abord la fiche d'un produit.</p>
                <p className="text-xs mt-2">Chaque conversation est liée à un article précis pour un suivi clair.</p>
              </div>
            )}
            {!noProduct && !sessionId && (
              <div className="text-sm text-muted-foreground space-y-3 py-2">
                <p>Bonjour&nbsp;! Une question sur <span className="font-semibold text-foreground">{product.name}</span>&nbsp;? Écrivez-nous.</p>
                <div>
                  <label className="text-xs font-medium">Votre prénom (optionnel)</label>
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="Ex: Alex"
                    maxLength={40}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
            {loading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender === "visitor"
                    ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                    : "mr-auto bg-card border border-border rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            ))}
            {sessionId && messages.length === 0 && !loading && (
              <div className="text-center text-xs text-muted-foreground py-6">
                Écrivez votre premier message ci-dessous 👇
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-border p-2 bg-card"
          >
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  noProduct
                    ? "Choisissez un produit pour écrire..."
                    : needsName
                      ? "Écrivez votre message..."
                      : "Votre message..."
                }
                rows={1}
                maxLength={2000}
                disabled={noProduct}
                className="min-h-[40px] max-h-32 resize-none text-sm"
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim() || noProduct} aria-label="Envoyer">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {visitorName && !noProduct && (
              <div className="text-[10px] text-muted-foreground mt-1 px-1">Connecté en tant que {visitorName}</div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
