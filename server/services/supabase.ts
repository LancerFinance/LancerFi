import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
// ⚠️ SECURITY: Never hardcode credentials in production code!
// Always use environment variables for sensitive data.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) in your environment.'
  );
}

// Use service key for backend operations (bypasses RLS)
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
