-- Update the profiles table to include freelancer-specific fields
-- Add fields for portfolio, experience, availability, etc.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT ARRAY['English'];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certifications TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS project_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS response_time TEXT DEFAULT '< 24 hours';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Insert some sample freelancer profiles for testing
INSERT INTO public.profiles (
  id, wallet_address, username, full_name, bio, skills, hourly_rate, 
  rating, completed_projects, total_earned, portfolio_url, experience_years,
  availability_status, location, response_time
) VALUES 
  (
    gen_random_uuid(),
    '7xKXtg2CW9J1x5g2CW9J1x5g2CW9J1x5g2CW9J1x5',
    'alex_chen_dev',
    'Alex Chen',
    'Experienced Web3 developer with 5+ years building DeFi protocols and dApps. Specialized in Solidity smart contracts, React frontends, and complex DeFi integrations.',
    ARRAY['Solidity', 'React', 'Node.js', 'DeFi', 'Web3.js', 'Hardhat'],
    120,
    4.9,
    47,
    85000,
    'https://portfolio.alexchen.dev',
    5,
    'available',
    'San Francisco, CA',
    '< 2 hours'
  ),
  (
    gen_random_uuid(),
    '8yLYuh3DX0K2y6h3DX0K2y6h3DX0K2y6h3DX0K2y6',
    'sarah_auditor',
    'Sarah Kim',
    'Security-focused smart contract auditor with expertise in DeFi and NFT protocols. Former security researcher at ConsenSys with deep knowledge of common vulnerabilities.',
    ARRAY['Solidity', 'Security', 'Auditing', 'Foundry', 'Slither', 'Mythril'],
    150,
    5.0,
    23,
    65000,
    'https://audits.sarahkim.eth',
    6,
    'busy',
    'Austin, TX',
    '< 4 hours'
  ),
  (
    gen_random_uuid(),
    '9zMZvi4EY1L3z7i4EY1L3z7i4EY1L3z7i4EY1L3z7',
    'marcus_designer',
    'Marcus Johnson',
    'Creative designer specializing in intuitive Web3 user experiences. Worked with top DeFi protocols to create user-friendly interfaces that drive adoption.',
    ARRAY['Figma', 'Web3 UX', 'Prototyping', 'Branding', 'Design Systems', 'User Research'],
    95,
    4.8,
    31,
    42000,
    'https://dribbble.com/marcusj_web3',
    4,
    'available',
    'New York, NY',
    '< 6 hours'
  ),
  (
    gen_random_uuid(),
    '0aNawi5FZ2M4a8j5FZ2M4a8j5FZ2M4a8j5FZ2M4a8',
    'elena_growth',
    'Elena Rodriguez',
    'Growth marketer helping Web3 projects build engaged communities. Expert in tokenomics design, community management, and go-to-market strategies.',
    ARRAY['Marketing', 'Community', 'Content', 'Growth', 'Tokenomics', 'Social Media'],
    80,
    4.7,
    19,
    28000,
    'https://elenarodriguez.com/portfolio',
    3,
    'available',
    'Miami, FL',
    '< 12 hours'
  )
ON CONFLICT (wallet_address) DO NOTHING;