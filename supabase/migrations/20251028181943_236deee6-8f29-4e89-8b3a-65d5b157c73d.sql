-- Add banner and profile photo to profiles table
ALTER TABLE public.profiles
ADD COLUMN banner_url text,
ADD COLUMN profile_photo_url text;

-- Add project images array to projects table
ALTER TABLE public.projects
ADD COLUMN project_images text[];

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.banner_url IS 'URL to the freelancer profile banner image';
COMMENT ON COLUMN public.profiles.profile_photo_url IS 'URL to the freelancer profile photo';
COMMENT ON COLUMN public.projects.project_images IS 'Array of image URLs showcasing the completed project';