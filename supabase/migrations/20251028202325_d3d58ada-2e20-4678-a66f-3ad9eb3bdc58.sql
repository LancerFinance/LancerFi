-- Drop the existing trigger on projects (it's not working correctly)
DROP TRIGGER IF EXISTS trigger_update_freelancer_stats_on_project ON public.projects;

-- Recreate the update_freelancer_stats function to handle both escrow and project updates
CREATE OR REPLACE FUNCTION public.update_freelancer_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_freelancer_id uuid;
BEGIN
  -- Determine which table triggered this function
  IF TG_TABLE_NAME = 'escrows' THEN
    -- Handle escrow release
    IF NEW.status = 'released' AND OLD.status != 'released' THEN
      SELECT p.freelancer_id INTO target_freelancer_id
      FROM public.projects p 
      WHERE p.id = NEW.project_id;
      
      IF target_freelancer_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET 
          total_earned = calculate_freelancer_earnings(wallet_address),
          completed_projects = (
            SELECT COUNT(*) 
            FROM public.projects p 
            WHERE p.freelancer_id = target_freelancer_id
              AND p.status = 'completed'
          )
        WHERE id = target_freelancer_id;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'projects' THEN
    -- Handle project completion
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
      IF NEW.freelancer_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET 
          completed_projects = (
            SELECT COUNT(*) 
            FROM public.projects p 
            WHERE p.freelancer_id = NEW.freelancer_id
              AND p.status = 'completed'
          ),
          total_earned = calculate_freelancer_earnings(wallet_address)
        WHERE id = NEW.freelancer_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger on projects
CREATE TRIGGER trigger_update_freelancer_stats_on_project
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_freelancer_stats();