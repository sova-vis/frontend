import type { NextApiRequest, NextApiResponse } from 'next';

// Demo: Accept all signups as students
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  // In production, save to DB and hash password
  return res.status(200).json({ message: 'Signup successful (demo, not saved)' });
}
