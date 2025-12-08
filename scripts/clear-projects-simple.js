#!/usr/bin/env node

/**
 * Simple script to clear all projects from the database
 * Uses the server's Supabase client configuration
 */

import { createClient } from '@supabase/supabase-js';

// Use the same defaults as server/services/supabase.ts
const SUPABASE_URL = process.env.SUPABASE_URL || "https://xhxcfyosctbvlvewyptf.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoeGNmeW9zY3Ridmx2ZXd5cHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4Nzg1OTYsImV4cCI6MjA3MzQ1NDU5Nn0.8q6W5IUDAq5-pSl16kiqD3hh21dymAlm9TeYZiv7EqA";

console.log('🗑️  Starting database cleanup...\n');
console.log(`Connecting to: ${SUPABASE_URL.substring(0, 30)}...\n`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false
  }
});

async function clearProjects() {
  try {
    // Get count first
    const { count, error: countError } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`📊 Found ${count || 0} projects to delete\n`);

    if (count === 0) {
      console.log('✅ No projects found. Database is already clean.');
      return;
    }

    // Delete all projects
    console.log('🗑️  Deleting all projects...');
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select('id')
      .limit(1000); // Get up to 1000 projects

    if (fetchError) {
      throw fetchError;
    }

    if (projects && projects.length > 0) {
      const projectIds = projects.map(p => p.id);
      
      // Delete in batches
      const batchSize = 100;
      for (let i = 0; i < projectIds.length; i += batchSize) {
        const batch = projectIds.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from('projects')
          .delete()
          .in('id', batch);

        if (deleteError) {
          throw deleteError;
        }
        console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1} (${batch.length} projects)`);
      }
    }

    console.log('✅ All projects deleted successfully\n');

    // Reset profile stats
    console.log('🔄 Resetting profile stats...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        total_earned: 0,
        completed_projects: 0
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (updateError) {
      console.warn('⚠️  Warning: Could not reset profile stats:', updateError.message);
    } else {
      console.log('✅ Profile stats reset successfully\n');
    }

    // Verify
    const { count: remainingCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ Cleanup complete! Remaining projects: ${remainingCount || 0}`);
    console.log('✅ Database is now clean and ready for GitHub upload.\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    if (error.details) console.error('Details:', error.details);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
}

// Run with timeout
const timeout = setTimeout(() => {
  console.error('❌ Script timed out after 30 seconds');
  process.exit(1);
}, 30000);

clearProjects()
  .then(() => {
    clearTimeout(timeout);
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    clearTimeout(timeout);
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

