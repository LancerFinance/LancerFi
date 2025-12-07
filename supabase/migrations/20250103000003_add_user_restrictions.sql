-- Add user restriction fields to profiles table
-- These fields allow admins to mute, ban users, and ban IP addresses

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS banned_ip_addresses TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.is_muted IS 'Whether the user is muted (cannot send messages)';
COMMENT ON COLUMN public.profiles.is_banned IS 'Whether the user is banned (wallet address banned)';
COMMENT ON COLUMN public.profiles.banned_ip_addresses IS 'Array of IP addresses that are banned for this user';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned) WHERE is_banned = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_is_muted ON public.profiles(is_muted) WHERE is_muted = TRUE;

