#!/usr/bin/env node

/**
 * Script to run the user restrictions migration
 * 
 * Usage: node scripts/run-migration.js
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

// Read the migration file
const migrationPath = join(__dirname, '../supabase/migrations/20250103000003_add_user_restrictions.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

async function runMigration() {
  console.log('🚀 Running migration: Add User Restrictions');
  console.log('📝 Migration file: 20250103000003_add_user_restrictions.sql');
  console.log('');
  
  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      // If exec_sql doesn't exist, try direct query
      console.log('⚠️  exec_sql function not found, trying direct execution...');
      
      // Split SQL by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.trim()) {
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
          if (stmtError) {
            // Try using the REST API directly
            const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
              },
              body: JSON.stringify({ sql: statement })
            });
            
            if (!response.ok) {
              throw new Error(`Failed to execute statement: ${statement.substring(0, 50)}...`);
            }
          }
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Added columns to profiles table:');
    console.log('  - email (TEXT)');
    console.log('  - is_muted (BOOLEAN)');
    console.log('  - is_banned (BOOLEAN)');
    console.log('  - banned_ip_addresses (TEXT[])');
    console.log('');
    console.log('Created indexes for faster lookups.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('💡 Alternative: Run the SQL directly in Supabase Dashboard:');
    console.error('   1. Go to https://supabase.com/dashboard');
    console.error('   2. Select your project');
    console.error('   3. Open SQL Editor');
    console.error('   4. Copy and paste the SQL from:');
    console.error(`      ${migrationPath}`);
    process.exit(1);
  }
}

runMigration();

