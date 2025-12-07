-- Create work_submissions table for freelancer work submissions
CREATE TABLE IF NOT EXISTS public.work_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  freelancer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  file_urls text[] DEFAULT '{}',
  link_urls text[] DEFAULT '{}',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revision_requested')),
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on work_submissions
ALTER TABLE public.work_submissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for work_submissions
CREATE POLICY "Work submissions viewable by project participants" 
  ON public.work_submissions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = work_submissions.project_id 
      AND (p.client_id = current_setting('request.headers', true)::json->>'x-wallet-address'
           OR EXISTS (
             SELECT 1 FROM public.profiles pr 
             WHERE pr.id = work_submissions.freelancer_id 
             AND pr.wallet_address = current_setting('request.headers', true)::json->>'x-wallet-address'
           ))
    )
  );

CREATE POLICY "Freelancers can create work submissions for their projects" 
  ON public.work_submissions FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.profiles pr ON pr.id = work_submissions.freelancer_id
      WHERE p.id = work_submissions.project_id
      AND p.freelancer_id = work_submissions.freelancer_id
      AND pr.wallet_address = current_setting('request.headers', true)::json->>'x-wallet-address'
    )
  );

CREATE POLICY "Clients can update work submissions for their projects" 
  ON public.work_submissions FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = work_submissions.project_id 
      AND p.client_id = current_setting('request.headers', true)::json->>'x-wallet-address'
    )
  );

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_work_submissions_project_id ON public.work_submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_work_submissions_freelancer_id ON public.work_submissions(freelancer_id);
CREATE INDEX IF NOT EXISTS idx_work_submissions_status ON public.work_submissions(status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_work_submissions_updated_at
  BEFORE UPDATE ON public.work_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_work_submissions_updated_at();

-- Create storage bucket for work submission files
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-submissions', 'work-submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for work-submissions bucket
CREATE POLICY "Anyone can view work submission files"
ON storage.objects FOR SELECT
USING (bucket_id = 'work-submissions');

CREATE POLICY "Authenticated users can upload work submission files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'work-submissions');

CREATE POLICY "Users can update work submission files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'work-submissions');

CREATE POLICY "Users can delete work submission files"
ON storage.objects FOR DELETE
USING (bucket_id = 'work-submissions');