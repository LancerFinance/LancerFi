-- Add client_ip column to projects table for IP-based rate limiting
-- This allows tracking project creation by IP address (3 projects per 6 hours)

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS client_ip text;

-- Add comment for clarity
COMMENT ON COLUMN public.projects.client_ip IS 'IP address of the client who created the project (for rate limiting)';

-- Create index for faster queries on IP-based rate limiting
CREATE INDEX IF NOT EXISTS idx_projects_client_ip_created_at 
ON public.projects(client_ip, created_at DESC);

