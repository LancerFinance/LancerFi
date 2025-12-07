-- Create messages table for freelancer-client communication
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL, 
  subject TEXT,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for messages
CREATE POLICY "Users can view their own messages" 
ON public.messages 
FOR SELECT 
USING (sender_id = ((current_setting('request.headers'::text, true))::json ->> 'x-wallet-address'::text) 
    OR recipient_id = ((current_setting('request.headers'::text, true))::json ->> 'x-wallet-address'::text));

CREATE POLICY "Users can send messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (sender_id = ((current_setting('request.headers'::text, true))::json ->> 'x-wallet-address'::text));

CREATE POLICY "Users can update their own messages" 
ON public.messages 
FOR UPDATE 
USING (sender_id = ((current_setting('request.headers'::text, true))::json ->> 'x-wallet-address'::text) 
    OR recipient_id = ((current_setting('request.headers'::text, true))::json ->> 'x-wallet-address'::text));

-- Create function to calculate total earnings for freelancers
CREATE OR REPLACE FUNCTION calculate_freelancer_earnings(freelancer_wallet TEXT)
RETURNS NUMERIC AS $$
DECLARE
  total_earnings NUMERIC := 0;
BEGIN
  -- Calculate total from completed escrows where freelancer was assigned
  SELECT COALESCE(SUM(e.amount_usdc), 0) INTO total_earnings
  FROM escrows e
  JOIN projects p ON e.project_id = p.id
  JOIN profiles pr ON p.freelancer_id = pr.id
  WHERE pr.wallet_address = freelancer_wallet 
    AND e.status = 'released'
    AND p.status = 'completed';
    
  RETURN total_earnings;
END;
$$ LANGUAGE plpgsql;

-- Create function to update freelancer stats
CREATE OR REPLACE FUNCTION update_freelancer_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_earned and completed_projects for the freelancer
  IF NEW.status = 'released' AND OLD.status != 'released' THEN
    UPDATE profiles 
    SET 
      total_earned = calculate_freelancer_earnings(wallet_address),
      completed_projects = (
        SELECT COUNT(*) 
        FROM projects p 
        WHERE p.freelancer_id = profiles.id 
          AND p.status = 'completed'
      )
    WHERE id = (
      SELECT p.freelancer_id 
      FROM projects p 
      WHERE p.id = NEW.project_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update freelancer stats when escrow is released
DROP TRIGGER IF EXISTS trigger_update_freelancer_stats ON escrows;
CREATE TRIGGER trigger_update_freelancer_stats
  AFTER UPDATE ON escrows
  FOR EACH ROW
  EXECUTE FUNCTION update_freelancer_stats();

-- Update updated_at trigger for messages
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();