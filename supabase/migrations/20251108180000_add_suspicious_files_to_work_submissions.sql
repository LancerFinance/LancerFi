-- Add suspicious files tracking to work_submissions table
ALTER TABLE public.work_submissions
ADD COLUMN IF NOT EXISTS has_suspicious_files boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS suspicious_files_details jsonb DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN public.work_submissions.has_suspicious_files IS 'Indicates if the submission contains files flagged as suspicious by security scanner';
COMMENT ON COLUMN public.work_submissions.suspicious_files_details IS 'JSON array of suspicious file details: [{filename, reason, severity}]';

