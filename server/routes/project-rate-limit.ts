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

export default router;

