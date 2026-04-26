// supabase/functions/delete-account/index.ts
// Supabase Edge Function: hard-delete the authenticated user from auth.users.
//
// The client SDK cannot call auth.admin.deleteUser() — that requires the service-role key.
// This Edge Function runs server-side with the service key and performs the hard delete.
//
// Deploy:
//   supabase functions deploy delete-account --project-ref fdbqjzifjkfdbwhlqlxt
//
// Flow:
//   1. Client calls delete_my_account() SQL RPC (soft-deletes team_members row)
//   2. Client calls this Edge Function with the user's JWT
//   3. Edge Function verifies the JWT, extracts the UID, calls admin.deleteUser(uid)
//   4. Client calls supabase.auth.signOut()

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Extract the caller's JWT from the Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Missing authorization', { status: 401 });
  }
  const jwt = authHeader.slice(7);

  // Verify the JWT and get the user
  const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: { user }, error: userError } = await anonClient.auth.getUser(jwt);
  if (userError || !user) {
    return new Response('Invalid token', { status: 401 });
  }

  // Use service-role client to hard-delete the auth user
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('delete-account error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
