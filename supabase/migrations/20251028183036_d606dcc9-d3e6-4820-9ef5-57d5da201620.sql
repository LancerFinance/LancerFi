-- Create storage buckets for profile images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('profile-banners', 'profile-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for profile photos
CREATE POLICY "Profile photos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their own profile photo" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile photo" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile photo" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'profile-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create storage policies for profile banners
CREATE POLICY "Profile banners are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-banners');

CREATE POLICY "Users can upload their own profile banner" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'profile-banners' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile banner" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'profile-banners' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile banner" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'profile-banners' AND
  auth.uid()::text = (storage.foldername(name))[1]
);