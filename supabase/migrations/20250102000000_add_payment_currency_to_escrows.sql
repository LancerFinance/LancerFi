-- Add payment_currency column to escrows table
ALTER TABLE public.escrows 
ADD COLUMN IF NOT EXISTS payment_currency text;

-- Add comment for documentation
COMMENT ON COLUMN public.escrows.payment_currency IS 'Payment currency used for escrow: USDC, SOLANA, or X402';

