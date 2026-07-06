import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const user = data.user;
    const confirmed =
      Boolean(user.email_confirmed_at) ||
      Boolean((user as { confirmed_at?: string | null }).confirmed_at) ||
      user.app_metadata?.provider !== "email";
    if (!confirmed) throw redirect({ to: "/verifier-email" });
    return { user };
  },
  component: () => <Outlet />,
});
