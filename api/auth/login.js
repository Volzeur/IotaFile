export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({ error: 'Missing GOOGLE_CLIENT_ID' });
  }

  // Dynamically build the base URL from the request host to prevent redirect_uri mismatch
  const host = req.headers.host;
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  
  const redirectUri = `${baseUrl}/api/auth/callback`;

  // ADDED: 'openid email profile' so Google returns the user's email address
  const scopes = 'openid email profile https://www.googleapis.com/auth/drive';

  // access_type=offline is CRITICAL: it tells Google to give us a refresh token
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;

  res.redirect(authUrl);
}
