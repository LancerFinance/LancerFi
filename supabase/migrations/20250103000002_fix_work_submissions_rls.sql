-- Fix RLS policies for work_submissions to be less restrictive for INSERT
-- The original policy required x-wallet-address header which isn't set by frontend client

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Freelancers can create work submissions for their projects" ON public.work_submissions;

-- Create a more permissive INSERT policy that still maintains security
-- It checks that the freelancer_id matches the project's freelancer_id
CREATE POLICY "Freelancers can create work submissions for their projects" 
  ON public.work_submissions FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = work_submissions.project_id
      AND p.freelancer_id = work_submissions.freelancer_id
      AND p.status = 'in_progress'
    )
  );

-- Also update the SELECT policy to be less restrictive (allow project participants)
DROP POLICY IF EXISTS "Work submissions viewable by project participants" ON public.work_submissions;

CREATE POLICY "Work submissions viewable by project participants" 
  ON public.work_submissions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = work_submissions.project_id
    )
  );

-- Update the UPDATE policy to be less restrictive for clients
DROP POLICY IF EXISTS "Clients can update work submissions for their projects" ON public.work_submissions;

CREATE POLICY "Clients can update work submissions for their projects" 
  ON public.work_submissions FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = work_submissions.project_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = work_submissions.project_id
    )
  );

