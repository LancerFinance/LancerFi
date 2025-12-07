-- Calculate freelancer total earned (released funds only, excludes platform fee)
CREATE OR REPLACE FUNCTION public.calculate_freelancer_earnings(input_freelancer_wallet text)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_earnings NUMERIC := 0;
BEGIN
  -- Sum only amounts actually earned by the freelancer (principal), when escrow is released
  SELECT COALESCE(SUM(e.amount_usdc), 0) INTO total_earnings
  FROM public.escrows e
  JOIN public.projects p ON e.project_id = p.id
  JOIN public.profiles pr ON p.freelancer_id = pr.id
  WHERE pr.wallet_address = input_freelancer_wallet
    AND e.status = 'released';
  
  RETURN total_earnings;
END;
$function$;