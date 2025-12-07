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

