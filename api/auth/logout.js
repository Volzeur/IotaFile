import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    const frontendUrl = process.env.FRONTEND_URL || '*';

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
        // Optional: attempt to revoke Google refresh token
        const userData = await redis.hgetall(`user:${email}`);

        if (userData && userData.refreshToken) {
            try {
                await fetch('https://oauth2.googleapis.com/revoke', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        token: userData.refreshToken
                    })
                });
            } catch (revokeError) {
                console.error('Google token revoke failed, continuing logout:', revokeError);
            }
        }

        // Delete the whole user session from Redis
        await redis.del(`user:${email}`);

        return res.status(200).json({
            success: true
        });
    } catch (error) {
        console.error('Logout crash:', error);
        return res.status(500).json({
            error: 'Logout failed'
        });
    }
}
