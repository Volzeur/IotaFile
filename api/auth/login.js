export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  // Vercel provides process.env.VERCEL_URL in production, fallback to localhost for dev
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/auth/callback`;
  const scopes = 'https://www.googleapis.com/auth/drive';
  
  // access_type=offline is CRITICAL: it tells Google to give us a refresh token
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;
  
  res.redirect(authUrl);
}