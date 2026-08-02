import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const userData = await kv.hgetall(`user:${email}`);
    if (!userData || !userData.refreshToken) {
      return res.status(401).json({ error: 'No refresh token found' });
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: userData.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      await kv.hdel(`user:${email}`, 'refreshToken'); // Clean up invalid token
      return res.status(401).json({ error: 'Failed to refresh token' });
    }

    return res.status(200).json({ access_token: tokens.access_token });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}