import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password, name } = req.body;
  const token = req.headers['authorization'];
  if (token !== 'admin-session-token') return res.status(403).json({ error: 'Forbidden' });
  // In production, call backend API here
  // For demo, just return success
  return res.status(200).json({ message: 'Teacher added (demo, not saved)' });
}
