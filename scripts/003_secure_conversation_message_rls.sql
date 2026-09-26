-- Restrict direct Supabase chat access to authenticated conversation members.
-- Apply this migration to Supabase only after verifying the production schema.
BEGIN;

DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Conversation participants can read messages" ON public.messages;
DROP POLICY IF EXISTS "Conversation participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view own conversation memberships" ON public.conversation_participants;

CREATE POLICY "Users can view own conversation memberships"
  ON public.conversation_participants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Conversation participants can read messages"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants AS participant
      WHERE participant.conversation_id = messages.conversation_id
        AND participant.user_id = auth.uid()
    )
  );

CREATE POLICY "Conversation participants can send messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants AS participant
      WHERE participant.conversation_id = messages.conversation_id
        AND participant.user_id = auth.uid()
    )
  );

COMMIT;
