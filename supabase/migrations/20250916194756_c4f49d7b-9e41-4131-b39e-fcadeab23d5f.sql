-- Drop and recreate the calculate_freelancer_earnings function with fixed parameter naming
DROP FUNCTION IF EXISTS public.calculate_freelancer_earnings(text);

CREATE OR REPLACE FUNCTION public.calculate_freelancer_earnings(input_freelancer_wallet text)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_earnings NUMERIC := 0;
BEGIN
  -- Calculate total from completed escrows where freelancer was assigned
  SELECT COALESCE(SUM(e.amount_usdc), 0) INTO total_earnings
  FROM public.escrows e
  JOIN public.projects p ON e.project_id = p.id
  JOIN public.profiles pr ON p.freelancer_id = pr.id
  WHERE pr.wallet_address = input_freelancer_wallet 
    AND e.status = 'released'
    AND p.status = 'completed';
    
  RETURN total_earnings;
END;
$function$;

-- Also update the update_freelancer_stats function to use the corrected parameter name
CREATE OR REPLACE FUNCTION public.update_freelancer_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;