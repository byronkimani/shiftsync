import { Router } from 'express';
import { db } from '../db';
import { notifications } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', requireAuth, async (req, res) => {
  try {
    const { userId } = req.auth!;
    
    const results = await db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: [desc(notifications.createdAt)],
      limit: 100 // Reasonable cap for the frontend bell dropdown
    });

    res.json({ data: results });
  } catch (error) {
    console.error('GET /notifications error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch notifications' } });
  }
});

notificationsRouter.patch('/notifications/read-all', requireAuth, async (req, res) => {
    try {
      const { userId } = req.auth!;
      
      await db.update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, userId));
  
      res.json({ success: true });
    } catch (error) {
      console.error('PATCH /notifications/read-all error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to mark notifications as read' } });
    }
});

const readParamsSchema = z.object({ id: z.string().uuid() });

notificationsRouter.patch('/notifications/:id/read', requireAuth, async (req, res) => {
    try {
      const { userId } = req.auth!;
      const parsed = readParamsSchema.safeParse(req.params);

      if (!parsed.success) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid ID' } });
      const { id } = parsed.data;
      
      const notif = await db.query.notifications.findFirst({ where: eq(notifications.id, id) });
      if (!notif) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Notification not found' } });

      if (notif.userId !== userId) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not your notification' } });

      const [updated] = await db.update(notifications)
        .set({ read: true })
        .where(eq(notifications.id, id))
        .returning();
  
      res.json({ data: updated });
    } catch (error) {
      console.error('PATCH /notifications/:id/read error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to mark notification as read' } });
    }
});
