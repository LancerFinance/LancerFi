-- Fix security issue: Restrict message access to sender and recipient only

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Messages viewable by everyone" ON public.messages;

-- Create secure policy that only allows sender and recipient to view messages
CREATE POLICY "Users can view their own messages" 
ON public.messages 
FOR SELECT 
USING (
  sender_id = ((current_setting('request.headers'::text, true))::json ->> 'x-wallet-address'::text)
  OR 
  recipient_id = ((current_setting('request.headers'::text, true))::json ->> 'x-wallet-address'::text)
);

-- Update insert policy to ensure users can only send messages as themselves
DROP POLICY IF EXISTS "Anyone can send messages" ON public.messages;

CREATE POLICY "Users can send messages as themselves" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  sender_id = ((current_setting('request.headers'::text, true))::json ->> 'x-wallet-address'::text)
);

-- Update the update policy to be more restrictive
DROP POLICY IF EXISTS "Senders or recipients can update messages" ON public.messages;

CREATE POLICY "Users can update their received messages" 
ON public.messages 
FOR UPDATE 
USING (
  recipient_id = ((current_setting('request.headers'::text, true))::json ->> 'x-wallet-address'::text)
) 
WITH CHECK (
  recipient_id = ((current_setting('request.headers'::text, true))::json ->> 'x-wallet-address'::text)
);