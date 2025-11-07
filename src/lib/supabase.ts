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
  // Freelancer-specific fields
  portfolio_url?: string;
  experience_years?: number;
  availability_status?: string;
  languages?: string[];
  education?: string;
  certifications?: string[];
  project_count?: number;
  response_time?: string;
  location?: string;
  timezone?: string;
  banner_url?: string;
  profile_photo_url?: string;
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
  project_images?: string[];
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
  payment_currency?: string;
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

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject?: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkSubmission {
  id: string;
  project_id: string;
  freelancer_id: string;
  description: string;
  file_urls?: string[];
  link_urls?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
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
      .select('*')
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
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
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

  async updateProject(id: string, updates: Partial<Project>) {
    // Convert freelancer_id from string to uuid if needed
    const processedUpdates = { ...updates };
    
    // If we're updating with a freelancer_id, ensure it's properly handled
    if (processedUpdates.freelancer_id) {
      // Verify the freelancer exists
      const { data: freelancer, error: freelancerError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', processedUpdates.freelancer_id)
        .single();
      
      if (freelancerError) {
        console.warn('Freelancer not found:', freelancerError);
        delete processedUpdates.freelancer_id;
      }
    }

    const { data, error } = await supabase
      .from('projects')
      .update(processedUpdates)
      .eq('id', id)
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
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async getEscrowById(id: string) {
    const { data, error } = await supabase
      .from('escrows')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getEscrows() {
    const { data, error } = await supabase
      .from('escrows')
      .select('*')
      .order('created_at', { ascending: false });
    
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
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async getProfileByWallet(walletAddress: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('wallet_address', walletAddress)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async getProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
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
  },

  async upsertProfileByWallet(walletAddress: string, profileData: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ 
        ...profileData, 
        wallet_address: walletAddress 
      }, { 
        onConflict: 'wallet_address' 
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Messages with proper user validation
  async getMessagesForUser(walletAddress: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${walletAddress},recipient_id.eq.${walletAddress}`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getMessages(userId: string) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createMessage(message: {
    sender_id: string;
    recipient_id: string;
    subject?: string;
    content: string;
  }) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        ...message,
        is_read: false
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async markMessageAsRead(messageId: string, walletAddress: string) {
    const { data, error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId)
      .eq('recipient_id', walletAddress)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Proposals
  async getProposals(projectId: string) {
    const { data, error } = await supabase
      .from('proposals')
      .select(`
        *,
        freelancer:freelancer_id (
          id,
          wallet_address,
          full_name,
          username,
          bio,
          skills,
          hourly_rate,
          total_earned,
          rating,
          completed_projects,
          portfolio_url,
          location
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async createProposal(proposal: Omit<Proposal, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('proposals')
      .insert(proposal)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateProposal(id: string, updates: Partial<Proposal>) {
    const { data, error } = await supabase
      .from('proposals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteProposalsByFreelancer(projectId: string, freelancerId: string) {
    const { data, error } = await supabase
      .from('proposals')
      .delete()
      .eq('project_id', projectId)
      .eq('freelancer_id', freelancerId)
      .select();
    
    if (error) {
      console.error('Error deleting proposals:', error);
      throw error;
    }
    
    console.log(`Deleted ${data?.length || 0} proposal(s) for freelancer ${freelancerId} on project ${projectId}`);
    return data;
  },

  async deleteProposal(proposalId: string) {
    const { error } = await supabase
      .from('proposals')
      .delete()
      .eq('id', proposalId);
    
    if (error) throw error;
  },

  // Work Submissions
  async createWorkSubmission(submission: Omit<WorkSubmission, 'id' | 'created_at' | 'updated_at' | 'submitted_at'>) {
    const { data, error } = await supabase
      .from('work_submissions')
      .insert({
        ...submission,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getWorkSubmissions(projectId: string) {
    const { data, error } = await supabase
      .from('work_submissions')
      .select('*')
      .eq('project_id', projectId)
      .order('submitted_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getWorkSubmission(id: string) {
    const { data, error } = await supabase
      .from('work_submissions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async updateWorkSubmission(id: string, updates: Partial<WorkSubmission>) {
    const { data, error } = await supabase
      .from('work_submissions')
      .update({
        ...updates,
        reviewed_at: updates.status && updates.status !== 'pending' ? new Date().toISOString() : undefined
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async sendWorkSubmissionNotification(
    projectId: string,
    projectTitle: string,
    clientWallet: string,
    freelancerWallet: string,
    submissionId: string,
    isNewSubmission: boolean = true,
    status?: 'approved' | 'rejected' | 'revision_requested',
    reviewNotes?: string
  ) {
    const systemSender = 'system@lancerfi.app';
    
    const notifications = [];
    
    if (isNewSubmission) {
      // Notify client that work has been submitted
      notifications.push({
        sender_id: systemSender,
        recipient_id: clientWallet,
        subject: 'Work Submitted for Review',
        content: `The freelancer has submitted work for your project "${projectTitle}". Please review the submission and approve or request revisions.`
      });
    } else {
      // Notify freelancer about review decision
      const statusMessage = status === 'approved' 
        ? 'Your work submission has been approved!'
        : status === 'rejected'
        ? 'Your work submission has been rejected. Please review the feedback and resubmit.'
        : 'Revision has been requested for your work submission. Please review the feedback and make the necessary changes.';
      
      const subject = status === 'approved' 
        ? 'Work Submission Approved'
        : status === 'rejected'
        ? 'Work Submission Rejected'
        : 'Revision Requested';
      
      notifications.push({
        sender_id: systemSender,
        recipient_id: freelancerWallet,
        subject: subject,
        content: `${statusMessage} Project: "${projectTitle}". ${reviewNotes ? `Review Notes: ${reviewNotes}` : ''}`
      });
    }

    // Insert notifications
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert(notifications)
        .select();
      
      if (error) {
        console.error('Error sending work submission notifications:', error);
      }
      return data;
    } catch (error) {
      console.error('Error sending work submission notifications:', error);
      return null;
    }
  },

  // Notifications
  async sendProjectCompletionNotification(
    projectId: string,
    clientWallet: string,
    freelancerWallet: string | null,
    projectTitle: string,
    amount: number,
    currency: string = 'SOLANA'
  ) {
    const systemSender = 'system@lancerfi.app'; // System identifier for notifications
    const currencyDisplay = currency === 'USDC' || currency === 'X402' 
      ? `$${amount.toLocaleString()} ${currency}` 
      : `${amount.toLocaleString()} SOL`;
    
    const notifications = [];
    
    // Notify client
    const clientMessage = {
      sender_id: systemSender,
      recipient_id: clientWallet,
      subject: 'Project Completed Successfully',
      content: `Your project "${projectTitle}" has been completed successfully. The escrow has been released and ${currencyDisplay} has been sent to the freelancer. You can view the project details in your dashboard.`
    };
    notifications.push(clientMessage);

    // Notify freelancer if they exist
    if (freelancerWallet) {
      const freelancerMessage = {
        sender_id: systemSender,
        recipient_id: freelancerWallet,
        subject: 'Payment Released - Project Completed',
        content: `Congratulations! The project "${projectTitle}" has been completed and marked as done by the client. The escrow has been released and ${currencyDisplay} has been sent to your wallet. You can view the transaction details in your dashboard.`
      };
      notifications.push(freelancerMessage);
    }

    // Insert all notifications
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert(notifications)
        .select();
      
      if (error) {
        console.error('Error sending completion notifications:', error);
        // Don't throw - notifications are non-critical
      }
      return data;
    } catch (error) {
      console.error('Error sending completion notifications:', error);
      // Don't throw - notifications are non-critical
      return null;
    }
  },

  // Get count of new proposals for a client (proposals on their active projects)
  // Excludes old proposals from kicked-off freelancers
  async getNewProposalsCount(clientWallet: string): Promise<number> {
    try {
      // Get all active projects for this client (where no freelancer has been assigned)
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, started_at')
        .eq('client_id', clientWallet)
        .eq('status', 'active')
        .is('freelancer_id', null);
      
      if (projectsError) throw projectsError;
      if (!projects || projects.length === 0) return 0;

      let totalValidProposals = 0;

      // For each project, get proposals and filter out old ones
      for (const project of projects) {
        try {
          const proposals = await this.getProposals(project.id);
          
          // If project has started_at, filter out proposals from previously assigned freelancers
          if (project.started_at) {
            try {
              // Get all work submissions to find which freelancers were previously assigned
              const workSubmissions = await this.getWorkSubmissions(project.id);
              const freelancerIdsFromWork = new Set(
                workSubmissions.map(sub => sub.freelancer_id).filter(Boolean)
              );
              
              // Check escrow to find the previously assigned freelancer's wallet
              let freelancerIdsFromEscrow = new Set<string>();
              try {
                const escrow = await this.getEscrow(project.id);
                if (escrow && escrow.freelancer_wallet) {
                  const freelancerProfile = await this.getProfileByWallet(escrow.freelancer_wallet);
                  if (freelancerProfile?.id) {
                    freelancerIdsFromEscrow.add(freelancerProfile.id);
                  }
                }
              } catch (escrowError) {
                // Ignore escrow errors
              }
              
              // Combine both strategies
              const previouslyAssignedFreelancerIds = new Set([
                ...Array.from(freelancerIdsFromWork),
                ...Array.from(freelancerIdsFromEscrow)
              ]);
              
              // Filter out only OLD proposals from previously assigned freelancers (created before started_at)
              // Allow NEW proposals from previously assigned freelancers (created after started_at)
              const startedAtDate = new Date(project.started_at);
              const validProposals = proposals.filter(proposal => {
                if (!proposal.freelancer_id) return true;
                
                // If this freelancer was previously assigned, only exclude OLD proposals
                if (previouslyAssignedFreelancerIds.has(proposal.freelancer_id)) {
                  const proposalDate = proposal.created_at ? new Date(proposal.created_at) : null;
                  // Exclude if proposal was created before project started (it's an old proposal)
                  if (proposalDate && proposalDate < startedAtDate) {
                    return false;
                  }
                  // Allow if proposal was created after project started (it's a new proposal)
                  return true;
                }
                
                // Exclude if proposal was created before project started (old proposals from any freelancer)
                if (proposal.created_at && new Date(proposal.created_at) < startedAtDate) {
                  return false;
                }
                
                return true;
              });
              
              totalValidProposals += validProposals.length;
            } catch (filterError) {
              // If filtering fails, count all proposals (fallback)
              console.error('Error filtering proposals for count:', filterError);
              totalValidProposals += proposals.length;
            }
          } else {
            // Project never had a freelancer assigned, count all proposals
            totalValidProposals += proposals.length;
          }
        } catch (error) {
          // If error loading proposals for this project, skip it
          console.error(`Error loading proposals for project ${project.id}:`, error);
        }
      }
      
      return totalValidProposals;
    } catch (error) {
      console.error('Error getting new proposals count:', error);
      return 0;
    }
  },

  // Get count of new work submissions for a client (pending submissions on their projects)
  async getNewWorkSubmissionsCount(clientWallet: string): Promise<number> {
    try {
      // Get all projects for this client
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('client_id', clientWallet);
      
      if (projectsError) throw projectsError;
      if (!projects || projects.length === 0) return 0;

      // Get count of pending work submissions for these projects
      const projectIds = projects.map(p => p.id);
      const { count, error: submissionsError } = await supabase
        .from('work_submissions')
        .select('*', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .eq('status', 'pending');
      
      if (submissionsError) throw submissionsError;
      return count || 0;
    } catch (error) {
      console.error('Error getting new work submissions count:', error);
      return 0;
    }
  },
};