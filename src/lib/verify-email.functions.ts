import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;

/**
 * Server-enforced rate limit for the "resend verification email" action.
 * Independent from client localStorage — cannot be bypassed by clearing the browser.
 * Persists attempts and next_allowed_at in `public.email_resend_attempts`.
 */
export const requestVerificationResend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context;
    const email = (claims as { email?: string }).email;
    if (!email) {
      return { ok: false as const, reason: "no_email", secondsLeft: 0 };
    }

    // Already verified? Do not resend.
    const emailVerified = Boolean(
      (claims as { email_verified?: boolean }).email_verified,
    );
    if (emailVerified) {
      return { ok: false as const, reason: "already_verified", secondsLeft: 0 };
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Read current attempt row.
    const { data: row } = await supabaseAdmin
      .from("email_resend_attempts")
      .select("attempts, next_allowed_at")
      .eq("user_id", userId)
      .maybeSingle();

    const now = Date.now();
    const nextAllowedAt = row?.next_allowed_at
      ? new Date(row.next_allowed_at).getTime()
      : 0;

    if (nextAllowedAt > now) {
      return {
        ok: false as const,
        reason: "cooldown" as const,
        secondsLeft: Math.ceil((nextAllowedAt - now) / 1000),
      };
    }

    const attempts = (row?.attempts ?? 0) + 1;
    const wait = Math.min(
      BASE_COOLDOWN_MS * 2 ** (attempts - 1),
      MAX_COOLDOWN_MS,
    );
    const nextAllowed = new Date(now + wait).toISOString();

    // Reserve the slot BEFORE calling Supabase so retries can't race.
    const { error: upsertError } = await supabaseAdmin
      .from("email_resend_attempts")
      .upsert(
        {
          user_id: userId,
          attempts,
          next_allowed_at: nextAllowed,
          last_sent_at: new Date(now).toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (upsertError) {
      return { ok: false as const, reason: "server_error", secondsLeft: 0 };
    }

    // Trigger the actual resend via Supabase Auth REST endpoint.
    const url = process.env.SUPABASE_URL!;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY!;
    try {
      const res = await fetch(`${url}/auth/v1/resend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anon,
        },
        body: JSON.stringify({ type: "signup", email }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[verify-email] resend failed", res.status, body);
        return {
          ok: false as const,
          reason: "provider_error" as const,
          secondsLeft: Math.ceil(wait / 1000),
        };
      }
    } catch (err) {
      console.error("[verify-email] resend network error", err);
      return {
        ok: false as const,
        reason: "network_error" as const,
        secondsLeft: Math.ceil(wait / 1000),
      };
    }

    return {
      ok: true as const,
      secondsLeft: Math.ceil(wait / 1000),
      attempts,
    };
  });

/**
 * Returns the current cooldown state for the signed-in user (no side effects).
 */
export const getVerificationResendState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row } = await supabaseAdmin
      .from("email_resend_attempts")
      .select("next_allowed_at, attempts")
      .eq("user_id", context.userId)
      .maybeSingle();
    const now = Date.now();
    const nextAllowedAt = row?.next_allowed_at
      ? new Date(row.next_allowed_at).getTime()
      : 0;
    return {
      secondsLeft: Math.max(0, Math.ceil((nextAllowedAt - now) / 1000)),
      attempts: row?.attempts ?? 0,
    };
  });
