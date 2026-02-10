import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password } = req.body;
  // Hardcoded admin credentials (must match backend)
  if (email === 'admin@propel.com' && password === 'SuperSecretAdmin123') {
    // In production, set a secure cookie or JWT
    return res.status(200).json({ token: 'admin-session-token', role: 'admin' });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
}
