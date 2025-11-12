-- Add restriction duration and expiration fields
-- This allows temporary restrictions that automatically expire

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS restriction_type TEXT,
ADD COLUMN IF NOT EXISTS restriction_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS restriction_reason TEXT,
ADD COLUMN IF NOT EXISTS last_ip_address TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.restriction_type IS 'Type of restriction: mute, ban_wallet, ban_ip';
COMMENT ON COLUMN public.profiles.restriction_expires_at IS 'When the restriction expires (NULL = permanent)';
COMMENT ON COLUMN public.profiles.restriction_reason IS 'Reason for the restriction';
COMMENT ON COLUMN public.profiles.last_ip_address IS 'Last known IP address for this user';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_restriction_expires ON public.profiles(restriction_expires_at) WHERE restriction_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_last_ip ON public.profiles(last_ip_address) WHERE last_ip_address IS NOT NULL;

-- Create a table to track IP bans separately (for IP-based bans affecting multiple users)
CREATE TABLE IF NOT EXISTS public.banned_ip_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  reason TEXT,
  banned_by_wallet TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banned_ips_ip ON public.banned_ip_addresses(ip_address);
CREATE INDEX IF NOT EXISTS idx_banned_ips_expires ON public.banned_ip_addresses(expires_at) WHERE expires_at IS NOT NULL;

