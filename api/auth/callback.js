import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // 1. CORS Headers (Update with your actual frontend URL)
  const frontendUrl = process.env.FRONTEND_URL || 'iotafile.web.app';
  res.setHeader('Access-Control-Allow-Origin', frontendUrl);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error: oauthError } = req.query;

  if (oauthError) {
    console.error('OAuth Error from Google:', oauthError);
    return res.status(400).json({ error: oauthError });
  }

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // Fail early if credentials are missing
  if (!clientId || !clientSecret) {
    console.error('Missing Google OAuth credentials in environment variables');
    return res.status(500).json({ error: 'Server configuration error: Missing credentials' });
  }

  // 2. Dynamically use the request host to guarantee redirect_uri matches perfectly
  const host = req.headers.host;
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  try {
    // 3. Exchange code for tokens
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

    if (tokens.error) {
      console.error('Google Token Error:', tokens);
      return res.status(400).json({ error: tokens.error, description: tokens.error_description });
    }

    // 4. Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userRes.json();

    if (!userInfo.email) {
      console.error('Failed to get user email from Google. Scopes might be missing.', userInfo);
      return res.status(400).json({ error: 'Failed to retrieve user email. Ensure "openid email" scopes are requested.' });
    }

    // 5. Save to Vercel KV
    await kv.hset(`user:${userInfo.email}`, {
      refreshToken: tokens.refresh_token,
      email: userInfo.email,
      name: userInfo.name || 'Unknown',
    });

    // 6. Redirect back to frontend
    res.redirect(`${frontendUrl}/?added=${encodeURIComponent(userInfo.email)}`);
    
  } catch (error) {
    console.error('Auth Callback Crash:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}
