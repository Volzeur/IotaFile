import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://iotafile.web.app';
    res.setHeader('Access-Control-Allow-Origin', frontendUrl);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Use query params if provided, otherwise fallback to environment variables
    const clientId = req.query.client_id || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = req.query.client_secret || process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId) {
        return res.status(500).json({ error: 'Missing Client ID' });
    }

    const host = req.headers.host;
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/api/auth/callback`;

    const scopes = 'openid email profile https://www.googleapis.com/auth/drive';

    // Generate a unique session ID and store credentials in Redis temporarily
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    try {
        await redis.hset(`session:${sessionId}`, {
            clientId,
            clientSecret: clientSecret || ''
        });
        await redis.expire(`session:${sessionId}`, 600); // 10 minutes expiry
    } catch (e) {
        console.error('Redis error in login:', e);
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${sessionId}`;
    
    res.redirect(authUrl);
}
