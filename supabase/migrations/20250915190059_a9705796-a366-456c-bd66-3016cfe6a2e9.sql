-- Fix profiles table to support better upsert functionality
-- Add unique constraint on wallet_address to enable proper upserts

-- Add unique constraint on wallet_address (if it doesn't exist)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_wallet_address_unique 
UNIQUE (wallet_address);

-- Update the profiles table comment to reflect improved functionality
COMMENT ON TABLE public.profiles IS 'User profiles with wallet-based authentication. wallet_address has unique constraint for upsert operations.';