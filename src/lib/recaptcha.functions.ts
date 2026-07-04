import { createServerFn } from "@tanstack/react-start";

/**
 * Verify a Google reCAPTCHA v2 / v3 token server-side.
 * Activated only when `RECAPTCHA_SECRET_KEY` is configured on the backend.
 * When the secret is missing, verification is a no-op (returns { ok: true, skipped: true }),
 * so the app keeps working in dev/preview without setup.
 */
export const verifyRecaptchaToken = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => {
    if (typeof data?.token !== "string" || data.token.length < 10 || data.token.length > 4096) {
      throw new Error("Invalid token");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) return { ok: true, skipped: true };
    try {
      const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: data.token }).toString(),
      });
      const json = (await res.json()) as { success: boolean; score?: number };
      if (!json.success) return { ok: false, skipped: false };
      if (typeof json.score === "number" && json.score < 0.4) return { ok: false, skipped: false };
      return { ok: true, skipped: false };
    } catch {
      // Fail-open in case Google is unreachable — DB trigger still protects.
      return { ok: true, skipped: true };
    }
  });
