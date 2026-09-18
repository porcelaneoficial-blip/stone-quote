CREATE TABLE public.pedra_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedra_threads TO authenticated;
GRANT ALL ON public.pedra_threads TO service_role;
ALTER TABLE public.pedra_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads" ON public.pedra_threads FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.pedra_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.pedra_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL,
  message jsonb NOT NULL,
  client_message_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX pedra_messages_thread_idx ON public.pedra_messages (thread_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedra_messages TO authenticated;
GRANT ALL ON public.pedra_messages TO service_role;
ALTER TABLE public.pedra_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.pedra_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER pedra_threads_updated_at BEFORE UPDATE ON public.pedra_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pedra_messages_updated_at BEFORE UPDATE ON public.pedra_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();