import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || "https://xhxcfyosctbvlvewyptf.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoeGNmeW9zY3Ridmx2ZXd5cHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4Nzg1OTYsImV4cCI6MjA3MzQ1NDU5Nn0.8q6W5IUDAq5-pSl16kiqD3hh21dymAlm9TeYZiv7EqA";

// Use service key for backend operations (bypasses RLS)
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

