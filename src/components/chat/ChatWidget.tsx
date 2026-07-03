import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const LS_KEY = "td_chat_session_v1";

type Msg = {
  id: string;
  session_id: string;
  sender: "visitor" | "admin";
  content: string;
  created_at: string;
};

function loadLS(): { id: string; name?: string } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [visitorName, setVisitorName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Init from localStorage
  useEffect(() => {
    const s = loadLS();
    if (s) {
      setSessionId(s.id);
      setVisitorName(s.name ?? "");
    }
  }, []);

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

  // Realtime subscription
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

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    const name = nameDraft.trim() || "Visiteur";
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        visitor_name: name,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
        product_context: typeof window !== "undefined" ? window.location.pathname : null,
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Impossible d'ouvrir la conversation");
      return null;
    }
    setSessionId(data.id);
    setVisitorName(name);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ id: data.id, name }));
    } catch {
      /* ignore */
    }
    return data.id;
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
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
      toast.error("Envoi impossible");
      setSending(false);
      return;
    }
    // Update session metadata (last message, unread admin)
    await supabase
      .from("chat_sessions")
      .update({ last_message_at: new Date().toISOString(), unread_admin: (messages.filter((m) => m.sender === "visitor").length + 1) })
      .eq("id", sid);
    setInput("");
    setSending(false);
  }

  const needsName = !sessionId && !nameDraft.trim();

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le chat"
          className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full gradient-accent text-accent-foreground shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm h-[70vh] max-h-[560px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border gradient-accent text-accent-foreground">
            <div>
              <div className="font-display font-semibold text-sm">Support TopDeals</div>
              <div className="text-[11px] opacity-90">On répond dès que possible</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="p-1 rounded hover:bg-black/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-muted/20">
            {!sessionId && (
              <div className="text-sm text-muted-foreground space-y-3 py-2">
                <p>Bonjour&nbsp;! Une question sur un produit&nbsp;? Écrivez-nous, on vous répond.</p>
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

          {/* Composer */}
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
                placeholder={needsName ? "Écrivez votre message..." : "Votre message..."}
                rows={1}
                maxLength={2000}
                className="min-h-[40px] max-h-32 resize-none text-sm"
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Envoyer">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {visitorName && (
              <div className="text-[10px] text-muted-foreground mt-1 px-1">Connecté en tant que {visitorName}</div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
