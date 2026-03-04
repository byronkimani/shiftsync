import { Router } from 'express';
import { db } from '../db';
import { notifications } from '../db/schema';
import { eq, desc, and, lt, count, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', requireAuth, async (req, res) => {
  try {
    const { userId } = req.auth!;
    
    const limit = parseInt(req.query.limit as string) || 50;
    const readParam = req.query.read as string;
    const cursor = req.query.cursor as string;
    
    const conditions = [eq(notifications.userId, userId)];
    
    if (readParam === 'false') {
        conditions.push(eq(notifications.read, false));
    } else if (readParam === 'true') {
        conditions.push(eq(notifications.read, true));
    }

    if (cursor) {
        // Simple date-based cursor pagination
        const cursorDate = new Date(parseInt(cursor));
        if (!isNaN(cursorDate.getTime())) {
            conditions.push(lt(notifications.createdAt, cursorDate));
        }
    }
    
    // Fetch notifications
    const results = await db.query.notifications.findMany({
      where: and(...conditions),
      orderBy: [desc(notifications.createdAt)],
      limit: limit
    });
    
    // Unread Count
    const unreadResult = await db.select({ count: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    const unreadCount = unreadResult[0].count;

    // Next cursor
    let nextCursor = null;
    if (results.length > 0 && results.length === limit) {
        nextCursor = results[results.length - 1].createdAt.getTime().toString();
    }

    res.json({ data: results, meta: { unreadCount, cursor: nextCursor } });
  } catch (error) {
    console.error('GET /notifications error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch notifications' } });
  }
});

const markReadSchema = z.object({
    all: z.boolean().optional(),
    ids: z.array(z.string().uuid()).optional()
}).refine(data => data.all || (data.ids && data.ids.length > 0), "Must provide 'all: true' or an array of UUIDs.");

notificationsRouter.post('/notifications/mark-read', requireAuth, async (req, res) => {
    try {
      const { userId } = req.auth!;
      const parsed = markReadSchema.safeParse(req.body);

      if (!parsed.success) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid payload' } });
      const { all, ids } = parsed.data;
      
      let updated = [];
      if (all) {
          updated = await db.update(notifications)
            .set({ read: true })
            .where(eq(notifications.userId, userId))
            .returning();
      } else if (ids && ids.length > 0) {
          // Verify ownership implicitly by adding userId to where clause
          updated = await db.update(notifications)
            .set({ read: true })
            .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)))
            .returning();
      }
  
      res.json({ success: true, count: updated.length });
    } catch (error) {
      console.error('POST /notifications/mark-read error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to mark notifications as read' } });
    }
});
