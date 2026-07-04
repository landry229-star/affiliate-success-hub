import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Trash2, Inbox, ExternalLink, Package } from "lucide-react";
import { toast } from "sonner";

type Session = {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  product_context: string | null;
  product_id: string | null;
  last_message_at: string;
  unread_admin: number;
  created_at: string;
  products?: { id: string; name: string; slug: string; image_url: string | null } | null;
};

type Msg = {
  id: string;
  session_id: string;
  sender: "visitor" | "admin";
  content: string;
  created_at: string;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function AdminChat() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["admin-chat-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*, products(id,name,slug,image_url)")
        .order("last_message_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Session[];
    },
    refetchInterval: 15000,
  });

  // Realtime new messages -> refresh sessions list + active thread
  useEffect(() => {
    const channel = supabase
      .channel("admin-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-chat-sessions"] });
        qc.invalidateQueries({ queryKey: ["admin-chat-messages"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_sessions" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-chat-sessions"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const sessions = sessionsQuery.data ?? [];
  const activeSession = useMemo(() => sessions.find((s) => s.id === activeId) ?? null, [sessions, activeId]);

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-180px)] min-h-[500px]">
      {/* List */}
      <div className="border border-border rounded-xl bg-card overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">Conversations</div>
          <Badge variant="secondary">{sessions.length}</Badge>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessionsQuery.isLoading && (
            <div className="p-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
          )}
          {!sessionsQuery.isLoading && sessions.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Aucune conversation pour l'instant.
            </div>
          )}
          {sessions.map((s) => {
            const isActive = s.id === activeId;
            return (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                  isActive ? "bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm truncate">{s.visitor_name || "Visiteur anonyme"}</div>
                  {s.unread_admin > 0 && (
                    <Badge className="h-5 min-w-5 px-1.5 text-[10px]">{s.unread_admin}</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {s.product_context || "—"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(s.last_message_at)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Thread */}
      <div className="border border-border rounded-xl bg-card overflow-hidden flex flex-col">
        {activeSession ? (
          <ChatThread session={activeSession} />
        ) : (
          <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
            Sélectionnez une conversation à gauche.
          </div>
        )}
      </div>
    </div>
  );
}

function ChatThread({ session }: { session: Session }) {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const msgsQuery = useQuery({
    queryKey: ["admin-chat-messages", session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  // Mark as read when opened
  useEffect(() => {
    if (session.unread_admin > 0) {
      supabase.from("chat_sessions").update({ unread_admin: 0 }).eq("id", session.id).then(() => {
        qc.invalidateQueries({ queryKey: ["admin-chat-sessions"] });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgsQuery.data]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const { error } = await supabase
      .from("chat_messages")
      .insert({ session_id: session.id, sender: "admin", content: text });
    if (error) {
      toast.error("Envoi impossible");
      setSending(false);
      return;
    }
    await supabase
      .from("chat_sessions")
      .update({ last_message_at: new Date().toISOString(), unread_visitor: 0 })
      .eq("id", session.id);
    setInput("");
    setSending(false);
    qc.invalidateQueries({ queryKey: ["admin-chat-messages", session.id] });
  }

  async function deleteSession() {
    if (!confirm("Supprimer cette conversation ?")) return;
    const { error } = await supabase.from("chat_sessions").delete().eq("id", session.id);
    if (error) {
      toast.error("Suppression impossible");
      return;
    }
    toast.success("Conversation supprimée");
    qc.invalidateQueries({ queryKey: ["admin-chat-sessions"] });
  }

  const messages = msgsQuery.data ?? [];

  return (
    <>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="font-semibold text-sm">{session.visitor_name || "Visiteur anonyme"}</div>
          <div className="text-xs text-muted-foreground">
            {session.product_context || "—"} · démarré {timeAgo(session.created_at)}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={deleteSession}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {msgsQuery.isLoading && (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
              m.sender === "admin"
                ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                : "mr-auto bg-card border border-border rounded-bl-sm"
            }`}
          >
            <div>{m.content}</div>
            <div className={`text-[10px] mt-1 ${m.sender === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
        {!msgsQuery.isLoading && messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">Aucun message dans cette conversation.</div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-border p-3 bg-card"
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
            placeholder="Votre réponse..."
            rows={1}
            maxLength={2000}
            className="min-h-[40px] max-h-40 resize-none text-sm"
          />
          <Button type="submit" disabled={sending || !input.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" />Envoyer</>}
          </Button>
        </div>
      </form>
    </>
  );
}
