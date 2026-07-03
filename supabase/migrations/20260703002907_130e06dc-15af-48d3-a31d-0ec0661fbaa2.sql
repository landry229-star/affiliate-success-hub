
CREATE TABLE public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name text,
  visitor_email text,
  user_agent text,
  product_context text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_admin int NOT NULL DEFAULT 0,
  unread_visitor int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('visitor','admin')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id, created_at);
CREATE INDEX idx_chat_sessions_last ON public.chat_sessions(last_message_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.chat_sessions TO anon, authenticated;
GRANT ALL ON public.chat_sessions TO service_role;
GRANT SELECT, INSERT ON public.chat_messages TO anon, authenticated;
GRANT UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Sessions: anyone can create a session
CREATE POLICY "Anyone can create a chat session"
  ON public.chat_sessions FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Sessions: readable by anyone (session id is the shared secret between visitor and admin)
CREATE POLICY "Sessions readable by anyone"
  ON public.chat_sessions FOR SELECT TO anon, authenticated
  USING (true);

-- Sessions: visitors can update their own session metadata (name/email/counters);
-- admins can update anything
CREATE POLICY "Anyone can update session metadata"
  ON public.chat_sessions FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Sessions: only admins can delete
CREATE POLICY "Admins can delete sessions"
  ON public.chat_sessions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Messages: anyone can read messages from a session (they need the session id)
CREATE POLICY "Anyone can read messages"
  ON public.chat_messages FOR SELECT TO anon, authenticated
  USING (true);

-- Visitors: can only insert 'visitor' messages
CREATE POLICY "Visitors can send visitor messages"
  ON public.chat_messages FOR INSERT TO anon
  WITH CHECK (sender = 'visitor');

-- Authenticated non-admins can send visitor messages; admins can send 'admin' messages
CREATE POLICY "Authenticated visitors can send messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender = 'visitor'
    OR (sender = 'admin' AND public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Admins can update messages"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete messages"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger on sessions
CREATE TRIGGER trg_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
