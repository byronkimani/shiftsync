import { Router } from 'express';
import { db } from '../db';
import { skills } from '../db/schema';
import { requireAuth } from '../middleware/auth';

export const skillsRouter = Router();

skillsRouter.get('/skills', requireAuth, async (req, res) => {
  try {
    const results = await db.select().from(skills).orderBy(skills.name);
    res.json({ data: results });
  } catch (error) {
    console.error('GET /skills error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch skills' } });
  }
});
