/**
 * Supabase client instances.
 * - adminClient: uses service role key — bypasses RLS (server-side only)
 * - userClient:  uses anon key + user JWT — respects RLS
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Check .env file.');
}

// Admin client — full access, never expose to frontend
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Build a per-request client that acts as the authenticated user
const getUserClient = (accessToken) =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

module.exports = { adminClient, getUserClient };
