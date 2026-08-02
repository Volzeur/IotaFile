import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.body;
  if (email) {
    await kv.hdel(`user:${email}`, 'refreshToken');
  }
  res.json({ success: true });
}