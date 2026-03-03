import { Router } from 'express';
import { db } from '../db';
import { availability, availabilityExceptions } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { z } from 'zod';

export const availabilityRouter = Router({ mergeParams: true });

// Note: Mounted at /api/users/:userId/availability and /api/users/:userId/availability-exceptions

// Helper to check read/write access to a specific user's availability
const verifyAccess = async (req: any, res: any, next: any) => {
  const targetUserId = req.params.userId;
  const { userId, role, locationIds } = req.auth!;

  if (role === 'admin' || targetUserId === userId) {
    return next();
  }

  // Manager reading/writing another user: must share at least one location
  // We can just rely on the user details fetch since it's cached or fast
  const targetLocations = await db.query.userLocations.findMany({
    where: (ul, { and, eq }) => and(eq(ul.userId, targetUserId), eq(ul.isActive, true))
  });

  const sharesLocation = targetLocations.some(l => locationIds.includes(l.locationId));
  if (!sharesLocation) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this user' } });
  }

  next();
};

availabilityRouter.get('/availability', requireAuth, verifyAccess, async (req, res) => {
  try {
    const userId = req.params.userId as string;
    const filterLocationId = req.query.locationId as string | undefined;

    let recurringQuery = db.select().from(availability).where(eq(availability.userId, userId));
    if (filterLocationId) {
       recurringQuery = db.select().from(availability)
         .where(and(eq(availability.userId, userId), eq(availability.locationId, filterLocationId)));
    }
    
    const exceptionsQuery = db.select().from(availabilityExceptions)
      .where(eq(availabilityExceptions.userId, userId));

    const [recurring, exceptions] = await Promise.all([recurringQuery, exceptionsQuery]);

    res.json({
      data: {
        recurring,
        exceptions
      }
    });

  } catch (error) {
    console.error('GET /availability error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch availability' } });
  }
});

const putAvailabilitySchema = z.object({
  rules: z.array(z.object({
    locationId: z.string().uuid(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid start time (HH:mm)'),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid end time (HH:mm)'),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    effectiveUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
  }))
});

availabilityRouter.put('/availability', requireAuth, verifyAccess, async (req, res) => {
  try {
    const parsed = putAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid payload', details: parsed.error.issues } });
    }

    const userId = req.params.userId as string;
    const rulesToInsert = parsed.data.rules.map(r => ({
      ...r,
      userId
    }));

    await db.transaction(async (tx) => {
      // 1. Delete all current recurring rules for this user
      // Note: A more complex system would just expire them by setting effectiveUntil, 
      // but the Chunk 5 simplest approach specifies deleting and inserting clean for PUT logic.
      await tx.delete(availability).where(eq(availability.userId, userId));

      // 2. Insert new ones
      if (rulesToInsert.length > 0) {
        await tx.insert(availability).values(rulesToInsert);
      }
    });

    const refreshed = await db.select().from(availability).where(eq(availability.userId, userId));
    res.json({ data: refreshed });
  } catch (error) {
    console.error('PUT /availability error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update availability' } });
  }
});

const exceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  available: z.boolean(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).nullable().optional(),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).nullable().optional(),
}).refine(data => {
  if (data.available && (!data.startTime || !data.endTime)) return false;
  if (data.available && data.startTime && data.endTime && data.startTime >= data.endTime) return false;
  if (!data.available && (data.startTime || data.endTime)) return false; // Enforce nulls if unavailable
  return true;
}, "If available, requires valid chronological times. If unavailable, times must be omitted/null.");

availabilityRouter.post('/availability-exceptions', requireAuth, verifyAccess, async (req, res) => {
  try {
    const parsed = exceptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid specific payload format', details: parsed.error.issues } });
    }

    const userId = req.params.userId as string;
    const { date, available, startTime, endTime } = parsed.data;

    const [exc] = await db.insert(availabilityExceptions).values({
      userId,
      date,
      available,
      startTime: available ? startTime : null,
      endTime: available ? endTime : null,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [availabilityExceptions.userId, availabilityExceptions.date],
      set: {
        available,
        startTime: available ? startTime : null,
        endTime: available ? endTime : null,
        updatedAt: new Date()
      }
    }).returning();

    res.json({ data: exc });
  } catch (error) {
    console.error('POST /availability-exceptions error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to upsert exception' } });
  }
});

availabilityRouter.delete('/availability-exceptions/:date', requireAuth, verifyAccess, async (req, res) => {
  try {
    const userId = req.params.userId as string;
    const date = req.params.date as string;

    const [deleted] = await db.delete(availabilityExceptions)
      .where(and(
        eq(availabilityExceptions.userId, userId),
        eq(availabilityExceptions.date, date)
      ))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Exception not found for date' } });
    }

    res.json({ success: true, data: { date: deleted.date } });
  } catch (error) {
    console.error('DELETE /availability-exceptions error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete exception' } });
  }
});
