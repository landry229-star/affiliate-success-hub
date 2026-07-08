
CREATE TABLE public.email_resend_attempts (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  attempts INT NOT NULL DEFAULT 0,
  next_allowed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_resend_attempts TO authenticated;
GRANT ALL ON public.email_resend_attempts TO service_role;

ALTER TABLE public.email_resend_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own resend attempts"
  ON public.email_resend_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_email_resend_attempts_updated_at
  BEFORE UPDATE ON public.email_resend_attempts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
