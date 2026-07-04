import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; theme?: "light" | "dark" },
      ) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

const SITE_KEY = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined) ?? "";

export function useRecaptchaEnabled() {
  return Boolean(SITE_KEY);
}

/**
 * Renders a Google reCAPTCHA v2 checkbox into the ref.
 * Returns { token, reset } — token null until the user solves the challenge.
 * If VITE_RECAPTCHA_SITE_KEY is not set, this is a no-op (token stays null; caller can ignore).
 */
export function useRecaptcha(containerRef: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [token, setToken] = useState<string | null>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !SITE_KEY || !containerRef.current) return;

    let mounted = true;
    const containerEl = containerRef.current;

    function render() {
      if (!mounted || !window.grecaptcha || !containerEl || widgetIdRef.current !== null) return;
      window.grecaptcha.ready(() => {
        if (!containerEl || widgetIdRef.current !== null) return;
        widgetIdRef.current = window.grecaptcha!.render(containerEl, {
          sitekey: SITE_KEY,
          callback: (t) => setToken(t),
          "expired-callback": () => setToken(null),
        });
      });
    }

    if (window.grecaptcha) {
      render();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-recaptcha="v2"]');
      if (!existing) {
        const s = document.createElement("script");
        s.src = "https://www.google.com/recaptcha/api.js?render=explicit";
        s.async = true;
        s.defer = true;
        s.dataset.recaptcha = "v2";
        s.onload = () => render();
        document.head.appendChild(s);
      } else {
        existing.addEventListener("load", render, { once: true });
      }
    }

    return () => {
      mounted = false;
    };
  }, [enabled, containerRef]);

  return {
    token,
    reset: () => {
      setToken(null);
      if (widgetIdRef.current !== null && window.grecaptcha) window.grecaptcha.reset(widgetIdRef.current);
    },
  };
}
