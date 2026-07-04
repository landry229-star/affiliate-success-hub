
CREATE OR REPLACE FUNCTION public.chat_messages_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
  last_msg_at timestamptz;
BEGIN
  -- Only enforce on visitor messages (admin bypasses)
  IF NEW.sender = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Content length
  IF NEW.content IS NULL OR length(btrim(NEW.content)) = 0 THEN
    RAISE EXCEPTION 'Message vide.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(NEW.content) > 2000 THEN
    RAISE EXCEPTION 'Message trop long (max 2000 caractères).' USING ERRCODE = 'check_violation';
  END IF;

  -- Cooldown: 2s between messages
  SELECT max(created_at) INTO last_msg_at
  FROM public.chat_messages
  WHERE session_id = NEW.session_id AND sender = 'visitor';
  IF last_msg_at IS NOT NULL AND (now() - last_msg_at) < interval '2 seconds' THEN
    RAISE EXCEPTION 'Merci de patienter quelques secondes entre deux messages.' USING ERRCODE = 'check_violation';
  END IF;

  -- Max 8 messages / minute
  SELECT count(*) INTO recent_count
  FROM public.chat_messages
  WHERE session_id = NEW.session_id
    AND sender = 'visitor'
    AND created_at > now() - interval '1 minute';
  IF recent_count >= 8 THEN
    RAISE EXCEPTION 'Trop de messages envoyés. Réessayez dans une minute.' USING ERRCODE = 'check_violation';
  END IF;

  -- Max 60 messages / hour
  SELECT count(*) INTO recent_count
  FROM public.chat_messages
  WHERE session_id = NEW.session_id
    AND sender = 'visitor'
    AND created_at > now() - interval '1 hour';
  IF recent_count >= 60 THEN
    RAISE EXCEPTION 'Limite horaire atteinte. Réessayez plus tard.' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_messages_rate_limit ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_rate_limit
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_rate_limit();
