   import { Redis } from '@upstash/redis';

   // Initialize Upstash Redis
   const redis = new Redis({
     url: process.env.KV_REST_API_URL,
     token: process.env.KV_REST_API_TOKEN,
   });

   export default async function handler(req, res) {
     // 1. Allow requests from your Firebase Hosting domain
     const frontendUrl = process.env.FRONTEND_URL || 'https://iotafile.web.app';
     res.setHeader('Access-Control-Allow-Origin', frontendUrl);
     res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
     res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

     if (req.method === 'OPTIONS') {
       return res.status(200).end(); // Handle preflight request
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

     if (!clientId || !clientSecret) {
       console.error('Missing Google OAuth credentials');
       return res.status(500).json({ error: 'Server configuration error: Missing credentials' });
     }

     // 2. Redirect URI must point to THIS Vercel backend dynamically
     const host = req.headers.host;
     const protocol = host.includes('localhost') ? 'http' : 'https';
     const redirectUri = `${protocol}://${host}/api/auth/callback`;

     try {
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

       const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
         headers: { Authorization: `Bearer ${tokens.access_token}` },
       });

       const userInfo = await userRes.json();

       if (!userInfo.email) {
         console.error('Failed to get user email. Scopes might be missing.', userInfo);
         return res.status(400).json({ error: 'Failed to retrieve user email. Ensure "openid email" scopes are requested.' });
       }

       // 3. Save to Upstash Redis
       await redis.hset(`user:${userInfo.email}`, {
         refreshToken: tokens.refresh_token,
         accessToken: tokens.access_token,
         email: userInfo.email,
         name: userInfo.name || 'Unknown',
         createdAt: new Date().toISOString(),
       });

       console.log(`Successfully authenticated and saved: ${userInfo.email}`);

       // 4. Redirect back to your FIREBASE frontend URL
       res.redirect(`${frontendUrl}/?added=${encodeURIComponent(userInfo.email)}`);
       
     } catch (error) {
       console.error('Auth Callback Crash:', error);
       return res.status(500).json({ error: 'Internal server error during authentication' });
     }
   }
