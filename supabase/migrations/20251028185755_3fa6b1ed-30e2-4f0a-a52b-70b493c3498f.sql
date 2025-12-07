-- Create storage bucket for project/service images
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for project-images bucket
CREATE POLICY "Anyone can view project images"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-images');

CREATE POLICY "Authenticated users can upload project images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-images');

CREATE POLICY "Users can update project images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-images');

CREATE POLICY "Users can delete project images"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-images');