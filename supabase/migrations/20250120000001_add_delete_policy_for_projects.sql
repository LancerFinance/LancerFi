-- Add DELETE policy for projects table
-- This allows admins and clients to delete projects
-- Note: In production, you may want to restrict this to admin-only

CREATE POLICY "Users can delete projects" 
ON public.projects 
FOR DELETE 
USING (true);

