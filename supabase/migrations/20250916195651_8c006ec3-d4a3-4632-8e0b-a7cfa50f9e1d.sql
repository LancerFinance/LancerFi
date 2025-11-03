-- Update calculation to include all escrows regardless of status
CREATE OR REPLACE FUNCTION public.calculate_freelancer_earnings(input_freelancer_wallet text)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_earnings NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(e.amount_usdc), 0) INTO total_earnings
  FROM public.escrows e
  WHERE e.freelancer_wallet = input_freelancer_wallet;
  RETURN total_earnings;
END;
$function$;