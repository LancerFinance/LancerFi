
-- Create trigger to update freelancer stats when escrow is released
CREATE TRIGGER trigger_update_freelancer_stats_on_escrow
  AFTER UPDATE ON public.escrows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_freelancer_stats();

-- Create trigger to update freelancer stats when project is completed
CREATE TRIGGER trigger_update_freelancer_stats_on_project
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION public.update_freelancer_stats();

-- Manually recalculate stats for all freelancers to fix existing data
DO $$
DECLARE
  freelancer_record RECORD;
BEGIN
  FOR freelancer_record IN 
    SELECT DISTINCT p.id, p.wallet_address
    FROM public.profiles p
    INNER JOIN public.projects proj ON proj.freelancer_id = p.id
  LOOP
    UPDATE public.profiles 
    SET 
      completed_projects = (
        SELECT COUNT(*) 
        FROM public.projects 
        WHERE freelancer_id = freelancer_record.id 
          AND status = 'completed'
      ),
      total_earned = COALESCE(
        (SELECT public.calculate_freelancer_earnings(freelancer_record.wallet_address)),
        0
      )
    WHERE id = freelancer_record.id;
  END LOOP;
END $$;
