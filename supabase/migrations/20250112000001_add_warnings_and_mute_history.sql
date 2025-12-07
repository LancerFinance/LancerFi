-- Add warnings and mute history tracking
-- This allows admins to warn users and track mute frequency

-- Add warning fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS warning_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_warning_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_warning_reason TEXT;

-- Create table to track mute history
CREATE TABLE IF NOT EXISTS public.mute_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  muted_by_wallet TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_mute_history_profile ON public.mute_history(profile_id);
CREATE INDEX IF NOT EXISTS idx_mute_history_muted_at ON public.mute_history(muted_at);
CREATE INDEX IF NOT EXISTS idx_profiles_warning_count ON public.profiles(warning_count);

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.warning_count IS 'Number of warnings the user has received';
COMMENT ON COLUMN public.profiles.last_warning_at IS 'Timestamp of the last warning';
COMMENT ON COLUMN public.profiles.last_warning_reason IS 'Reason for the last warning';
COMMENT ON TABLE public.mute_history IS 'Tracks mute history to enforce 3 mutes per week limit';

