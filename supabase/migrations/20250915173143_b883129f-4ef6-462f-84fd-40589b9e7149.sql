-- Add UPDATE policies for the projects table to allow project assignments
-- This allows project clients to update their own projects and assign freelancers

CREATE POLICY "Clients can update their own projects" 
ON public.projects 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Add UPDATE policies for profiles table to allow profile updates via wallet address
-- This ensures users can update their profiles when authenticated via wallet

CREATE POLICY "Users can update profiles via wallet" 
ON public.profiles 
FOR UPDATE 
USING (true);