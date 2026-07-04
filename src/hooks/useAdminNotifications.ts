import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Global admin realtime listener: plays a chime, shows a browser notification
 * and a toast whenever a visitor sends a new chat message. Active only while
 * the admin dashboard is mounted.
 */
export function useAdminNotifications(onNavigateToChat?: () => void) {
  const qc = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedAtRef = useRef<number>(Date.now());

  // Request browser notification permission once
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Prepare chime audio (short synthesized beep via data URI)
  useEffect(() => {
    // A tiny mp3 ping (~ 0.2s) inlined so no asset is needed.
    const src =
      "data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAAEQwCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr////////////////////////////////////////////////////////////8AAAAATGF2YzYwLjMAAAAAAAAAAAAAAAAkA0AAAAAAAAAAEQ0AhaZgAAAA==";
    audioRef.current = new Audio(src);
    audioRef.current.volume = 0.4;
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-notify")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: "sender=eq.visitor" },
        (payload) => {
          // Ignore any inserts from before the admin opened the dashboard
          const created = new Date((payload.new as { created_at: string }).created_at).getTime();
          if (created < mountedAtRef.current - 2000) return;

          const content = (payload.new as { content: string }).content ?? "";
          const preview = content.length > 80 ? `${content.slice(0, 80)}…` : content;

          // Sound
          audioRef.current?.play().catch(() => {});

          // Toast in-app
          toast.info("Nouveau message visiteur", {
            description: preview,
            action: onNavigateToChat ? { label: "Ouvrir", onClick: onNavigateToChat } : undefined,
          });

          // Browser notification if page is hidden
          if (
            typeof document !== "undefined" &&
            document.hidden &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              const n = new Notification("Nouveau message TopDeals", { body: preview });
              n.onclick = () => {
                window.focus();
                onNavigateToChat?.();
              };
            } catch {
              /* ignore */
            }
          }

          // Invalidate lists
          qc.invalidateQueries({ queryKey: ["admin-chat-sessions"] });
          qc.invalidateQueries({ queryKey: ["admin-chat-messages"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, onNavigateToChat]);
}
