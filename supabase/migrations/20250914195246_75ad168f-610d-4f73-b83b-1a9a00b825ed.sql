-- Create profiles table for user information
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE,
  username text,
  full_name text,
  bio text,
  skills text[],
  hourly_rate numeric,
  total_earned numeric DEFAULT 0,
  rating numeric,
  completed_projects integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create escrows table for smart contract management
CREATE TABLE public.escrows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  client_wallet text NOT NULL,
  freelancer_wallet text,
  amount_usdc numeric NOT NULL,
  platform_fee numeric NOT NULL,
  total_locked numeric NOT NULL,
  solana_program_id text,
  escrow_account text,
  transaction_signature text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'funded', 'released', 'disputed', 'refunded')),
  created_at timestamptz DEFAULT now(),
  funded_at timestamptz,
  released_at timestamptz
);

-- Create milestones table for project tracking
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  escrow_id uuid REFERENCES public.escrows(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  amount_usdc numeric NOT NULL,
  due_date timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'approved', 'rejected')),
  submitted_at timestamptz,
  approved_at timestamptz,
  work_description text,
  deliverable_urls text[],
  created_at timestamptz DEFAULT now()
);

-- Create proposals table for freelancer applications
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  freelancer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  cover_letter text NOT NULL,
  proposed_budget numeric NOT NULL,
  estimated_timeline text NOT NULL,
  milestones jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (wallet_address = current_setting('request.headers', true)::json->>'x-wallet-address');
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (true);

-- Create RLS policies for escrows
CREATE POLICY "Escrows viewable by project participants" ON public.escrows FOR SELECT USING (true);
CREATE POLICY "Clients can create escrows" ON public.escrows FOR INSERT WITH CHECK (true);
CREATE POLICY "Project participants can update escrows" ON public.escrows FOR UPDATE USING (true);

-- Create RLS policies for milestones
CREATE POLICY "Milestones viewable by project participants" ON public.milestones FOR SELECT USING (true);
CREATE POLICY "Project participants can create milestones" ON public.milestones FOR INSERT WITH CHECK (true);
CREATE POLICY "Project participants can update milestones" ON public.milestones FOR UPDATE USING (true);

-- Create RLS policies for proposals
CREATE POLICY "Proposals viewable by everyone" ON public.proposals FOR SELECT USING (true);
CREATE POLICY "Anyone can create proposals" ON public.proposals FOR INSERT WITH CHECK (true);
CREATE POLICY "Freelancers can update their own proposals" ON public.proposals FOR UPDATE USING (true);

-- Add missing columns to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS freelancer_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS completed_at timestamptz;