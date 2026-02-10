import type { NextApiRequest, NextApiResponse } from 'next';

// Demo in-memory users
const users = [
  { email: 'teacher@propel.com', password: 'teach123', role: 'teacher' },
  { email: 'student@propel.com', password: 'stud123', role: 'student' },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password } = req.body;
  if (email === 'admin@propel.com' && password === 'SuperSecretAdmin123') {
    return res.status(403).json({ error: 'Use admin login page.' });
  }
  const user = users.find(u => u.email === email && u.password === password);
  if (user) return res.status(200).json({ role: user.role });
  return res.status(401).json({ error: 'Invalid credentials' });
}
