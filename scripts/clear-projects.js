#!/usr/bin/env node

/**
 * Script to clear all projects from the database
 * This will also cascade delete related records:
 * - escrows
 * - milestones
 * - proposals
 * - work_submissions
 * 
 * It will also reset profile stats (total_earned, completed_projects)
 * 
 * Usage: node scripts/clear-projects.js
 * 
 * Make sure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in your environment
 * or in server/.env file
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load environment variables from server/.env
let SUPABASE_URL = process.env.SUPABASE_URL;
let SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  try {
    const envPath = join(__dirname, '../server/.env');
    const envFile = readFileSync(envPath, 'utf-8');
    const envVars = {};
    
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        envVars[key] = value;
      }
    });
    
    SUPABASE_URL = SUPABASE_URL || envVars.SUPABASE_URL;
    SUPABASE_SERVICE_KEY = SUPABASE_SERVICE_KEY || envVars.SUPABASE_SERVICE_KEY || envVars.SUPABASE_ANON_KEY;
  } catch (err) {
    // .env file not found, use defaults
  }
}

// Require environment variables - no hardcoded defaults for security
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Error: Missing required environment variables!');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in your environment');
  console.error('or create a server/.env file with these variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function clearProjects() {
  console.log('🗑️  Starting database cleanup...\n');

  try {
    // First, get count of projects before deletion
    const { count: projectCount, error: countError } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`📊 Found ${projectCount || 0} projects to delete\n`);

    if (projectCount === 0) {
      console.log('✅ No projects found. Database is already clean.');
      return;
    }

    // Delete all projects (cascade will handle related records)
    // We need to delete with a condition that matches all rows
    // Using a subquery to get all project IDs
    console.log('🗑️  Deleting all projects...');
    
    // Get all project IDs first
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select('id');

    if (fetchError) {
      throw fetchError;
    }

    if (projects && projects.length > 0) {
      const projectIds = projects.map(p => p.id);
      
      // Delete in batches if needed (Supabase has limits)
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
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all (using condition that's always true)

    if (updateError) {
      console.warn('⚠️  Warning: Could not reset profile stats:', updateError.message);
    } else {
      console.log('✅ Profile stats reset successfully\n');
    }

    // Verify deletion
    const { count: remainingCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ Cleanup complete! Remaining projects: ${remainingCount || 0}`);
    console.log('✅ Database is now clean and ready for GitHub upload.\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the cleanup
clearProjects()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

