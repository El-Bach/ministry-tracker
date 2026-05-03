// supabase/functions/send-contact-email/index.ts
// Supabase Edge Function — sends contact form email via Resend API
// Deploy: supabase functions deploy send-contact-email
// Secret:  supabase secrets set RESEND_API_KEY=re_xxxxxxxx
//
// Hardening (Phase 8):
//  - Requires `Authorization: Bearer <jwt>` and verifies the caller via
//    auth.getUser() — anonymous abuse is no longer possible
//  - reply_to is forced to the authenticated user's email (no spoofing)
//  - Rate-limit: 5 messages per user per hour, recorded in
//    `contact_message_log` table

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TO_EMAIL          = 'management@kts-lb.com';

const RATE_LIMIT_PER_HOUR = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Verify JWT ────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonError(401, 'Missing Authorization header');
    }
    const jwt = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !userData?.user) {
      return jsonError(401, 'Invalid or expired token');
    }
    const authId = userData.user.id;
    const authEmail = userData.user.email ?? '';

    // ── 2. Parse + validate input ────────────────────────────────────
    const { subject, message } = await req.json();
    if (!subject || !message) {
      return jsonError(400, 'subject and message are required');
    }
    if (String(subject).length > 200 || String(message).length > 5000) {
      return jsonError(400, 'subject or message too long');
    }

    // ── 3. Rate-limit check (service-role bypasses RLS) ──────────────
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count, error: countErr } = await supabaseAdmin
      .from('contact_message_log')
      .select('id', { count: 'exact', head: true })
      .eq('auth_id', authId)
      .gte('created_at', oneHourAgo);
    if (countErr) {
      console.error('[contact] rate-limit count error:', countErr);
    } else if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return jsonError(429, `Too many messages — please wait an hour (limit: ${RATE_LIMIT_PER_HOUR}/hour)`);
    }

    // ── 4. Send via Resend ───────────────────────────────────────────
    const emailBody = [
      `From: ${authEmail}`,
      `User ID: ${authId}`,
      '',
      String(message),
    ].join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     'GovPilot <noreply@kts-lb.com>',
        to:       [TO_EMAIL],
        subject:  `[GovPilot] ${String(subject).slice(0, 200)}`,
        text:     emailBody,
        // reply_to is locked to the authenticated email — never client-supplied
        reply_to: authEmail,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[contact] Resend error:', data);
      return jsonError(res.status, 'Email send failed');
    }

    // ── 5. Log to rate-limit table (best-effort) ─────────────────────
    await supabaseAdmin.from('contact_message_log').insert({
      auth_id: authId,
      email:   authEmail,
      subject: String(subject).slice(0, 200),
    });

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status:  200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('[contact] Edge function error:', err);
    return jsonError(500, 'Internal error');
  }
});

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
