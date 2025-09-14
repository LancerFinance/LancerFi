import { supabase as supabaseClient } from "@/integrations/supabase/client";

export const supabase = supabaseClient;
export const isSupabaseConfigured = true;

// Database types
export interface Profile {
  id: string;
  wallet_address?: string;
  username?: string;
  full_name?: string;
  bio?: string;
  skills?: string[];
  hourly_rate?: number;
  total_earned?: number;
  rating?: number;
  completed_projects?: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  freelancer_id?: string;
  title: string;
  description: string;
  category: string;
  required_skills: string[];
  budget_usdc: number;
  timeline: string;
  status: 'draft' | 'active' | 'in_progress' | 'completed' | 'disputed' | 'cancelled';
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  client?: Profile;
  freelancer?: Profile;
}

export interface Escrow {
  id: string;
  project_id: string;
  client_wallet: string;
  freelancer_wallet?: string;
  amount_usdc: number;
  platform_fee: number;
  total_locked: number;
  solana_program_id?: string;
  escrow_account?: string;
  transaction_signature?: string;
  status: 'pending' | 'funded' | 'released' | 'disputed' | 'refunded';
  created_at: string;
  funded_at?: string;
  released_at?: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  escrow_id: string;
  title: string;
  description?: string;
  amount_usdc: number;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  submitted_at?: string;
  approved_at?: string;
  work_description?: string;
  deliverable_urls?: string[];
  created_at: string;
}

export interface Proposal {
  id: string;
  project_id: string;
  freelancer_id: string;
  cover_letter: string;
  proposed_budget: number;
  estimated_timeline: string;
  milestones?: any;
  created_at: string;
  freelancer?: Profile;
}

// Database functions
export const db = {
  // Projects
  async createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getProjects(filters?: { status?: string; category?: string }) {
    let query = supabase
      .from('projects')
      .select(`
        *,
        client:profiles!client_id(*),
        freelancer:profiles!freelancer_id(*)
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getProject(id: string) {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        client:profiles!client_id(*),
        freelancer:profiles!freelancer_id(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Escrows
  async createEscrow(escrow: Omit<Escrow, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('escrows')
      .insert(escrow)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateEscrow(id: string, updates: Partial<Escrow>) {
    const { data, error } = await supabase
      .from('escrows')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getEscrow(projectId: string) {
    const { data, error } = await supabase
      .from('escrows')
      .select('*')
      .eq('project_id', projectId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Milestones
  async createMilestone(milestone: Omit<Milestone, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('milestones')
      .insert(milestone)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateMilestone(id: string, updates: Partial<Milestone>) {
    const { data, error } = await supabase
      .from('milestones')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getMilestones(projectId: string) {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at');
    
    if (error) throw error;
    return data;
  },

  // Profiles
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateProfile(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};