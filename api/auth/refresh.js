import { Redis } from '@upstash/redis';

// Initialize Redis using the Vercel auto-created environment variables
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // Allow CORS for your frontend
  const frontendUrl = process.env.FRONTEND_URL || 'https://iotafile.web.app';
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // 1. Fetch user data from Redis
    const userData = await redis.hgetall(`user:${email}`);

    if (!userData || !userData.refreshToken) {
      return res.status(401).json({ error: 'No refresh token found. Please log in again.' });
    }

    // 2. Exchange refresh token for a new access token
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
      console.error('Google Refresh Token Error:', tokens);
      return res.status(401).json({ error: 'Failed to refresh token', details: tokens.error });
    }

    // 3. Update the access token in Redis for future use
    await redis.hset(`user:${email}`, {
      accessToken: tokens.access_token,
    });

    // 4. Send the new access token back to the frontend
    return res.status(200).json({
      access_token: tokens.access_token,
    });

  } catch (error) {
    console.error('Refresh Token Crash:', error);
    return res.status(500).json({ error: 'Internal server error during token refresh' });
  }
}
