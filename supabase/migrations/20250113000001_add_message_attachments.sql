-- Add attachments field to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for message-attachments bucket
CREATE POLICY "Anyone can view message attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'message-attachments');

CREATE POLICY "Authenticated users can upload message attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'message-attachments');

CREATE POLICY "Users can update message attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'message-attachments');

CREATE POLICY "Users can delete message attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'message-attachments');

