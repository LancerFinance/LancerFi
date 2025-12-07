-- Add is_hidden column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.projects.is_hidden IS 'If true, project is hidden from browse/search but still exists in database';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_projects_is_hidden ON public.projects(is_hidden) WHERE is_hidden = false;

