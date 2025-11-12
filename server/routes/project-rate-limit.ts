import { Router, Request, Response } from 'express';
import { supabaseClient } from '../services/supabase.js';

const router = Router();

/**
 * Get client IP address from request
 */
function getClientIP(req: Request): string {
  // Check various headers for IP (handles proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  
  if (typeof forwarded === 'string') {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  if (typeof realIP === 'string') {
    return realIP;
  }
  
  if (typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }
  
  // Fallback to connection remote address
  return req.socket.remoteAddress || req.ip || 'unknown';
}

/**
 * Check if wallet can create a project (2 projects per 24 hours)
 */
router.post('/check-wallet-limit', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ 
        allowed: false, 
        error: 'walletAddress is required',
        count: 0,
        limit: 2
      });
    }
    
    const supabase = supabaseClient;
    
    // Get current timestamp and 24 hours ago
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Count projects created by this wallet in the last 24 hours
    // Only count projects that have successfully created escrow (status = 'funded')
    // This ensures failed escrow creations don't count toward the limit
    let count = 0;
    let error = null;
    let fundedEscrows: any[] = [];
    
    try {
      // First, get all escrows for this wallet that are funded
      const { data: escrows, error: escrowError } = await supabase
        .from('escrows')
        .select('project_id, created_at')
        .eq('client_wallet', walletAddress)
        .eq('status', 'funded')
        .order('created_at', { ascending: false });
      
      if (escrowError) {
        error = escrowError;
      } else if (escrows && escrows.length > 0) {
        fundedEscrows = escrows;
        // Get project IDs from funded escrows
        const projectIds = escrows.map(e => e.project_id);
        
        // Get projects created in the last 24 hours
        const { data: recentProjects, error: projectError } = await supabase
          .from('projects')
          .select('id, created_at')
          .in('id', projectIds)
          .eq('client_id', walletAddress)
          .gte('created_at', twentyFourHoursAgo.toISOString());
        
        if (projectError) {
          error = projectError;
        } else {
          count = recentProjects?.length || 0;
        }
      }
    } catch (e: any) {
      error = e;
    }
    
    if (error) {
      console.error('Error checking wallet limit:', error);
      // Fail open - allow if we can't check
      return res.json({ 
        allowed: true, 
        reason: 'Unable to verify wallet limit',
        count: 0,
        limit: 2
      });
    }
    
    const projectCount = count || 0;
    const allowed = projectCount < 2;
    
    if (!allowed) {
      // Find the oldest project in the last 24 hours to calculate remaining time
      let remainingHours = 24;
      if (fundedEscrows && fundedEscrows.length > 0) {
        const oldestEscrow = fundedEscrows[fundedEscrows.length - 1];
        const oldestProjectTime = new Date(oldestEscrow.created_at);
        const hoursSinceOldest = (now.getTime() - oldestProjectTime.getTime()) / (1000 * 60 * 60);
        remainingHours = Math.ceil(24 - hoursSinceOldest);
      }
      
      return res.json({
        allowed: false,
        count: projectCount,
        limit: 2,
        reason: `Wallet has reached the limit of 2 projects in 24 hours. Please wait ${remainingHours} more hour${remainingHours > 1 ? 's' : ''} before creating another project.`,
        remainingHours
      });
    }
    
    return res.json({
      allowed: true,
      count: projectCount,
      limit: 2,
      reason: `Wallet has created ${projectCount}/2 projects in the last 24 hours`
    });
  } catch (error: any) {
    console.error('Error in wallet limit check:', error);
    // Fail open - allow if there's an error
    return res.json({ 
      allowed: true, 
      reason: 'Error checking wallet limit',
      count: 0,
      limit: 2
    });
  }
});

/**
 * Check if IP can create a project (3 projects per 6 hours)
 */
router.post('/check-ip-limit', async (req: Request, res: Response) => {
  try {
    const clientIP = getClientIP(req);
    const supabase = supabaseClient;
    
    // Get current timestamp and 6 hours ago
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    
    // Count projects created by this IP in the last 6 hours
    // Only count projects that have successfully created escrow (status = 'funded')
    // This ensures failed escrow creations don't count toward the limit
    // Note: client_ip column may not exist yet - handle gracefully
    let count = 0;
    let error = null;
    
    try {
      // First, get projects by IP in the last 6 hours
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id')
        .eq('client_ip', clientIP)
        .gte('created_at', sixHoursAgo.toISOString());
      
      if (projectsError) {
        // If column doesn't exist, return 0 count (fail open)
        if (projectsError.message?.includes('column') || projectsError.message?.includes('does not exist')) {
          console.log('client_ip column not found, allowing request');
          count = 0;
        } else {
          error = projectsError;
        }
      } else if (projects && projects.length > 0) {
        // Check which of these projects have funded escrows
        const projectIds = projects.map(p => p.id);
        const { count: fundedCount, error: escrowError } = await supabase
          .from('escrows')
          .select('*', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .eq('status', 'funded');
        
        if (escrowError) {
          error = escrowError;
        } else {
          count = fundedCount || 0;
        }
      }
    } catch (e: any) {
      // If column doesn't exist, return 0 count (fail open)
      if (e.message?.includes('column') || e.message?.includes('does not exist')) {
        console.log('client_ip column not found, allowing request');
        count = 0;
      } else {
        error = e;
      }
    }
    
    if (error) {
      console.error('Error checking IP limit:', error);
      // Fail open - allow if we can't check
      return res.json({ 
        allowed: true, 
        reason: 'Unable to verify IP limit',
        count: 0,
        limit: 3
      });
    }
    
    const projectCount = count || 0;
    const allowed = projectCount < 3;
    
    return res.json({
      allowed,
      count: projectCount,
      limit: 3,
      reason: allowed 
        ? `IP has created ${projectCount}/3 projects in the last 6 hours`
        : `IP has reached the limit of 3 projects in 6 hours. Please wait before creating another project.`
    });
  } catch (error: any) {
    console.error('Error in IP limit check:', error);
    // Fail open - allow if there's an error
    return res.json({ 
      allowed: true, 
      reason: 'Error checking IP limit',
      count: 0,
      limit: 3
    });
  }
});

/**
 * Record a project creation attempt (called after project is created)
 */
router.post('/record-project-creation', async (req: Request, res: Response) => {
  try {
    const { projectId, walletAddress } = req.body;
    const clientIP = getClientIP(req);
    const supabase = supabaseClient;
    
    if (!projectId || !walletAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing projectId or walletAddress' 
      });
    }
    
    // Update the project with the client IP
    // Note: client_ip column may not exist yet - handle gracefully
    try {
      const { error } = await supabase
        .from('projects')
        .update({ client_ip: clientIP })
        .eq('id', projectId)
        .eq('client_id', walletAddress);
      
      if (error) {
        // If column doesn't exist, that's okay - just log it
        if (error.message?.includes('column') || error.message?.includes('does not exist')) {
          console.log('client_ip column not found, skipping IP recording');
          return res.json({ 
            success: true, 
            message: 'Project created (IP column not available)' 
          });
        }
        
        console.error('Error recording project creation:', error);
        // Don't fail the request if recording fails
        return res.json({ 
          success: false, 
          error: 'Failed to record IP, but project was created' 
        });
      }
    } catch (e: any) {
      // If column doesn't exist, that's okay
      if (e.message?.includes('column') || e.message?.includes('does not exist')) {
        console.log('client_ip column not found, skipping IP recording');
        return res.json({ 
          success: true, 
          message: 'Project created (IP column not available)' 
        });
      }
      throw e;
    }
    
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error recording project creation:', error);
    return res.json({ 
      success: false, 
      error: error.message || 'Unknown error' 
    });
  }
});

/**
 * Reset rate limit for testing (development only)
 * Updates project creation times to be older than 24 hours
 */
router.post('/reset-rate-limit', async (req: Request, res: Response) => {
  try {
    // Allow rate limit reset for testing (can be restricted later if needed)
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'walletAddress is required' 
      });
    }
    
    const supabase = supabaseClient;
    
    // Get all projects for this wallet that have funded escrows
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, created_at')
      .eq('client_id', walletAddress)
      .gte('created_at', new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()); // Last 25 hours
    
    if (projectsError) {
      return res.status(500).json({ 
        success: false, 
        error: projectsError.message 
      });
    }
    
    if (!projects || projects.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No recent projects found to reset',
        reset: 0
      });
    }
    
    // Update project creation times to be 25 hours ago (older than 24 hour limit)
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const projectIds = projects.map(p => p.id);
    
    const { error: updateError } = await supabase
      .from('projects')
      .update({ created_at: oldDate })
      .in('id', projectIds)
      .eq('client_id', walletAddress);
    
    if (updateError) {
      return res.status(500).json({ 
        success: false, 
        error: updateError.message 
      });
    }
    
    return res.json({ 
      success: true, 
      message: `Reset rate limit for ${projects.length} project(s)`,
      reset: projects.length
    });
  } catch (error: any) {
    console.error('Error resetting rate limit:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown error' 
    });
  }
});

export default router;
