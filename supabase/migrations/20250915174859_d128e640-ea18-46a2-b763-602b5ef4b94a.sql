-- Fix security warnings by setting search_path properly for functions

-- Fix calculate_freelancer_earnings function
CREATE OR REPLACE FUNCTION calculate_freelancer_earnings(freelancer_wallet TEXT)
RETURNS NUMERIC 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_earnings NUMERIC := 0;
BEGIN
  -- Calculate total from completed escrows where freelancer was assigned
  SELECT COALESCE(SUM(e.amount_usdc), 0) INTO total_earnings
  FROM public.escrows e
  JOIN public.projects p ON e.project_id = p.id
  JOIN public.profiles pr ON p.freelancer_id = pr.id
  WHERE pr.wallet_address = freelancer_wallet 
    AND e.status = 'released'
    AND p.status = 'completed';
    
  RETURN total_earnings;
END;
$$;

-- Fix update_freelancer_stats function
CREATE OR REPLACE FUNCTION update_freelancer_stats()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update total_earned and completed_projects for the freelancer
  IF NEW.status = 'released' AND OLD.status != 'released' THEN
    UPDATE public.profiles 
    SET 
      total_earned = calculate_freelancer_earnings(wallet_address),
      completed_projects = (
        SELECT COUNT(*) 
        FROM public.projects p 
        WHERE p.freelancer_id = public.profiles.id 
          AND p.status = 'completed'
      )
    WHERE id = (
      SELECT p.freelancer_id 
      FROM public.projects p 
      WHERE p.id = NEW.project_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;