// Cloudflare Pages Function: POST /api/contact
// Sends the contact form to CONTACT_TO via Resend when RESEND_API_KEY is set.
interface Env {
  RESEND_API_KEY?: string;
  CONTACT_TO?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const form = await request.formData();

  // Honeypot — real users never fill this field.
  if (form.get('company_website')) {
    return Response.json({ ok: true });
  }

  const name = String(form.get('name') ?? '').slice(0, 100).trim();
  const email = String(form.get('email') ?? '').slice(0, 250).trim();
  const phone = String(form.get('phone') ?? '').slice(0, 50).trim();
  const message = String(form.get('message') ?? '').slice(0, 5000).trim();

  if (!name || !email.includes('@')) {
    return Response.json({ ok: false, error: 'invalid' }, { status: 400 });
  }

  if (!env.RESEND_API_KEY) {
    // Not configured yet — surface a clear error so the front-end shows the mailto fallback.
    return Response.json({ ok: false, error: 'not-configured' }, { status: 501 });
  }

  const to = env.CONTACT_TO || 'info@sshk.ltd';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SSHK Website <website@sshk.ltd>',
      to: [to],
      reply_to: email,
      subject: `Website enquiry from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || '—'}\n\n${message || '(no message)'}`,
    }),
  });

  if (!res.ok) {
    return Response.json({ ok: false, error: 'send-failed' }, { status: 502 });
  }
  return Response.json({ ok: true });
};
