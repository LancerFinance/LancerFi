-- Fix calculate_freelancer_earnings to join through projects table and use total_locked for consistency with dashboard
CREATE OR REPLACE FUNCTION public.calculate_freelancer_earnings(input_freelancer_wallet text)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_earnings NUMERIC := 0;
BEGIN
  -- Sum total_locked from escrows where the project is assigned to the freelancer
  SELECT COALESCE(SUM(e.total_locked), 0) INTO total_earnings
  FROM public.escrows e
  JOIN public.projects p ON e.project_id = p.id
  JOIN public.profiles pr ON p.freelancer_id = pr.id
  WHERE pr.wallet_address = input_freelancer_wallet;
  
  RETURN total_earnings;
END;
$function$;