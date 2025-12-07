/**
 * Project cleanup routes
 * Handles cleanup of stuck/failed projects
 */

import { Router, Request, Response } from 'express';
import { supabaseClient } from '../services/supabase.js';

const router = Router();

/**
 * Cleanup projects stuck in 'pending' status for over 1 hour
 * This handles cases where escrow creation failed or was abandoned
 */
router.post('/cleanup-pending', async (req: Request, res: Response) => {
  try {
    const supabase = supabaseClient;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

    // Find all pending projects older than 1 hour
    const { data: pendingProjects, error: fetchError } = await supabase
      .from('projects')
      .select('id, project_images, created_at')
      .eq('status', 'pending')
      .lt('created_at', oneHourAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching pending projects:', fetchError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch pending projects',
        message: fetchError.message 
      });
    }

    if (!pendingProjects || pendingProjects.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No pending projects to cleanup',
        cleaned: 0 
      });
    }

    const projectIds = pendingProjects.map(p => p.id);
    let cleanedCount = 0;
    let imageCleanupErrors = 0;

    // Update status to 'failed' for all pending projects
    const { error: updateError } = await supabase
      .from('projects')
      .update({ status: 'failed' })
      .in('id', projectIds);

    if (updateError) {
      console.error('Error updating project status:', updateError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update project status',
        message: updateError.message 
      });
    }

    cleanedCount = projectIds.length;

    // Clean up associated images (non-blocking)
    for (const project of pendingProjects) {
      if (project.project_images && project.project_images.length > 0) {
        try {
          // Extract file paths from image URLs
          const imagePaths = project.project_images
            .map((url: string) => {
              // Extract filename from Supabase storage URL
              const match = url.match(/project-images\/([^?]+)/);
              return match ? match[1] : null;
            })
            .filter(Boolean);

          if (imagePaths.length > 0) {
            const { error: deleteError } = await supabase
              .from('projects')
              .select('project_images')
              .eq('id', project.id)
              .single();

            // Try to delete from storage (may fail if already deleted, that's okay)
            try {
              const { error: storageError } = await supabase.storage
                .from('project-images')
                .remove(imagePaths as string[]);
              
              if (storageError) {
                console.warn(`Failed to delete images for project ${project.id}:`, storageError);
                imageCleanupErrors++;
              }
            } catch (storageErr) {
              console.warn(`Error deleting images for project ${project.id}:`, storageErr);
              imageCleanupErrors++;
            }
          }
        } catch (err) {
          console.warn(`Error processing image cleanup for project ${project.id}:`, err);
          imageCleanupErrors++;
        }
      }
    }

    // Clean up any orphaned escrows (escrows without a valid project)
    try {
      const { data: orphanedEscrows, error: escrowError } = await supabase
        .from('escrows')
        .select('id, project_id')
        .in('project_id', projectIds)
        .neq('status', 'funded');

      if (!escrowError && orphanedEscrows && orphanedEscrows.length > 0) {
        // Delete orphaned escrows (non-funded escrows for failed projects)
        const { error: deleteEscrowError } = await supabase
          .from('escrows')
          .delete()
          .in('id', orphanedEscrows.map(e => e.id));

        if (deleteEscrowError) {
          console.warn('Error deleting orphaned escrows:', deleteEscrowError);
        }
      }
    } catch (escrowCleanupErr) {
      console.warn('Error during escrow cleanup:', escrowCleanupErr);
    }

    return res.json({ 
      success: true, 
      message: `Cleaned up ${cleanedCount} pending project(s)`,
      cleaned: cleanedCount,
      imageCleanupErrors,
      projectIds 
    });
  } catch (error: any) {
    console.error('Error in cleanup-pending:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * Get statistics about pending projects
 */
router.get('/pending-stats', async (req: Request, res: Response) => {
  try {
    const supabase = supabaseClient;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { data: pendingProjects, error } = await supabase
      .from('projects')
      .select('id, created_at')
      .eq('status', 'pending');

    if (error) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch pending projects',
        message: error.message 
      });
    }

    const totalPending = pendingProjects?.length || 0;
    const stuckPending = pendingProjects?.filter(p => 
      new Date(p.created_at) < oneHourAgo
    ).length || 0;

    return res.json({
      success: true,
      totalPending,
      stuckPending,
      needsCleanup: stuckPending > 0
    });
  } catch (error: any) {
    console.error('Error in pending-stats:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

export default router;

