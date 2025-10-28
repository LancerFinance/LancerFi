-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can upload their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own profile banner" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile banner" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile banner" ON storage.objects;

-- Create permissive policies for profile photos (anyone authenticated can upload)
CREATE POLICY "Anyone can upload profile photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'profile-photos');

CREATE POLICY "Anyone can update profile photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'profile-photos');

CREATE POLICY "Anyone can delete profile photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'profile-photos');

-- Create permissive policies for profile banners (anyone authenticated can upload)
CREATE POLICY "Anyone can upload profile banners" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'profile-banners');

CREATE POLICY "Anyone can update profile banners" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'profile-banners');

CREATE POLICY "Anyone can delete profile banners" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'profile-banners');