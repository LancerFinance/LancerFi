-- Fix ambiguous column reference in calculate_freelancer_earnings function
CREATE OR REPLACE FUNCTION public.calculate_freelancer_earnings(freelancer_wallet text)
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
  WHERE pr.wallet_address = freelancer_wallet 
    AND e.status = 'released'
    AND p.status = 'completed';
    
  RETURN total_earnings;
END;
$function$