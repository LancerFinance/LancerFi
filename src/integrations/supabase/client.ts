import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables with fallbacks
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://xhxcfyosctbvlvewyptf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoeGNmeW9zY3Ridmx2ZXd5cHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4Nzg1OTYsImV4cCI6MjA3MzQ1NDU5Nn0.8q6W5IUDAq5-pSl16kiqD3hh21dymAlm9TeYZiv7EqA";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});