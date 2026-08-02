import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // 1. Allow requests from your Firebase Hosting domain
  res.setHeader('Access-Control-Allow-Origin', 'https://your-firebase-app.web.app'); // REPLACE WITH YOUR FIREBASE URL
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // Handle preflight request
  }

  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // 2. Redirect URI must point to THIS Vercel backend, not Firebase
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/auth/callback`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const tokens = await tokenRes.json();
  if (tokens.error) return res.status(400).json(tokens);

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userRes.json();

  await kv.hset(`user:${userInfo.email}`, {
    refreshToken: tokens.refresh_token,
    email: userInfo.email,
    name: userInfo.name,
  });

  // 3. Redirect back to your FIREBASE frontend URL
  const frontendUrl = process.env.FRONTEND_URL || 'https://your-firebase-app.web.app'; // REPLACE WITH YOUR FIREBASE URL
  res.redirect(`${frontendUrl}/?added=${encodeURIComponent(userInfo.email)}`);
}