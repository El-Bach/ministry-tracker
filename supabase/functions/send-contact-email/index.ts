// supabase/functions/send-contact-email/index.ts
// Supabase Edge Function — sends contact form email via Resend API
// Deploy: supabase functions deploy send-contact-email
// Secret:  supabase secrets set RESEND_API_KEY=re_xxxxxxxx

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const TO_EMAIL       = 'management@kts-lb.com';

serve(async (req: Request) => {
  // Allow CORS for mobile clients
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { sender_name, sender_email, subject, message } = await req.json();

    if (!subject || !message) {
      return new Response(JSON.stringify({ error: 'subject and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const emailBody = [
      sender_name  ? `From: ${sender_name}` : '',
      sender_email ? `Email: ${sender_email}` : '',
      '',
      message,
    ].filter(Boolean).join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'GovPilot <noreply@kts-lb.com>',
        to:      [TO_EMAIL],
        subject: `[GovPilot] ${subject}`,
        text:    emailBody,
        reply_to: sender_email || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return new Response(JSON.stringify({ error: data }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: {
        'Content-Type':                 'application/json',
        'Access-Control-Allow-Origin':  '*',
      },
    });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
