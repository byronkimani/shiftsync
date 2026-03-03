import { Router } from 'express';
import { db } from '../db';
import { shifts, shiftAssignments, users } from '../db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { NotificationService } from '../services/notificationService';
import { z } from 'zod';

export const shiftsRouter = Router();

// GET /api/shifts?locationId=...&startUtc=...&endUtc=...
shiftsRouter.get('/shifts', requireAuth, async (req, res) => {
  try {
    const { locationId, startUtc, endUtc } = req.query;

    if (!locationId || typeof locationId !== 'string') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'locationId is required' } });
    }

    // RBAC: If not admin, verify user shares the requested location
    const { role, locationIds } = req.auth!;
    if (role !== 'admin' && !locationIds.includes(locationId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No access to this location' } });
    }

    let query = db.query.shifts.findMany({
      where: and(
        eq(shifts.locationId, locationId),
        startUtc ? gte(shifts.startUtc, new Date(startUtc as string)) : undefined,
        endUtc ? lte(shifts.endUtc, new Date(endUtc as string)) : undefined
      ),
      with: {
        assignments: {
          with: {
            user: {
              columns: { id: true, name: true, email: true, role: true }
            }
          }
        }
      },
      orderBy: (shifts, { asc }) => [asc(shifts.startUtc)]
    });

    const results = await query;
    res.json({ data: results });
  } catch (error) {
    console.error('GET /shifts error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch shifts' } });
  }
});

const postShiftSchema = z.object({
  locationId: z.string().uuid(),
  skillId: z.string().uuid(),
  startUtc: z.string().datetime(),
  endUtc: z.string().datetime(),
  headcountRequired: z.number().int().min(1).default(1),
  isPremium: z.boolean().default(false),
  notes: z.string().optional()
});

shiftsRouter.post('/shifts', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const parsed = postShiftSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid payload', details: parsed.error.issues } });
    }

    // RBAC check on locationId
    const { role, locationIds, userId } = req.auth!;
    if (role !== 'admin' && !locationIds.includes(parsed.data.locationId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot create shift for a location you do not manage' } });
    }

    const { locationId, skillId, startUtc, endUtc, headcountRequired, isPremium, notes } = parsed.data;

    const [newShift] = await db.insert(shifts).values({
      locationId,
      skillId,
      startUtc: new Date(startUtc),
      endUtc: new Date(endUtc),
      headcountRequired,
      isPremium,
      notes,
      createdBy: userId,
      status: 'draft',
      updatedAt: new Date(),
    }).returning();

    res.status(201).json({ data: newShift });
  } catch (error) {
    console.error('POST /shifts error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create shift' } });
  }
});

const patchShiftSchema = z.object({
  startUtc: z.string().datetime().optional(),
  endUtc: z.string().datetime().optional(),
  headcountRequired: z.number().int().min(1).optional(),
  isPremium: z.boolean().optional(),
  notes: z.string().optional()
});

shiftsRouter.patch('/shifts/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const parsed = patchShiftSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid payload', details: parsed.error.issues } });
    }

    const targetShift = await db.query.shifts.findFirst({ where: eq(shifts.id, req.params.id as string) });
    if (!targetShift) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift not found' } });

    // RBAC logic
    const { role, locationIds } = req.auth!;
    if (role !== 'admin' && !locationIds.includes(targetShift.locationId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot edit shift outside your location' } });
    }

    const updateData: any = { updatedAt: new Date() };
    if (parsed.data.startUtc) updateData.startUtc = new Date(parsed.data.startUtc);
    if (parsed.data.endUtc) updateData.endUtc = new Date(parsed.data.endUtc);
    if (parsed.data.headcountRequired !== undefined) updateData.headcountRequired = parsed.data.headcountRequired;
    if (parsed.data.isPremium !== undefined) updateData.isPremium = parsed.data.isPremium;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const [updatedShift] = await db.update(shifts)
      .set(updateData)
      .where(eq(shifts.id, req.params.id as string))
      .returning();

    res.json({ data: updatedShift });
  } catch (error) {
    console.error('PATCH /shifts/:id error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update shift' } });
  }
});

shiftsRouter.patch('/shifts/:id/publish', requireRole('admin', 'manager'), async (req, res) => {
    try {
      const targetShift = await db.query.shifts.findFirst({ where: eq(shifts.id, req.params.id as string) });
      if (!targetShift) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift not found' } });
  
      const { role, locationIds } = req.auth!;
      if (role !== 'admin' && !locationIds.includes(targetShift.locationId)) {
          return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot edit shift outside your location' } });
      }
  
      if (targetShift.status !== 'draft') {
          return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Shift is already published or cancelled' } });
      }
  
      const [updatedShift] = await db.update(shifts)
        .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
        .where(eq(shifts.id, req.params.id as string))
        .returning();
  
      // Notify assigned users
      const assignments = await db.query.shiftAssignments.findMany({
        where: eq(shiftAssignments.shiftId, updatedShift.id)
      });

      for (const assignment of assignments) {
        if (assignment.status === 'assigned') {
           await NotificationService.notify(
             assignment.userId,
             'shift_published',
             'A new shift has been published to your schedule.',
             { shiftId: updatedShift.id }
           );
        }
      }

      res.json({ data: updatedShift });
    } catch (error) {
      console.error('PATCH /shifts/:id/publish error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to publish shift' } });
    }
  });

shiftsRouter.delete('/shifts/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const targetShift = await db.query.shifts.findFirst({ where: eq(shifts.id, req.params.id as string) });
    if (!targetShift) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift not found' } });

    const { role, locationIds } = req.auth!;
    if (role !== 'admin' && !locationIds.includes(targetShift.locationId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot delete shift outside your location' } });
    }

    // Checking if assignments exist.
    const assignmentsCount = await db.select({ id: shiftAssignments.id }).from(shiftAssignments).where(eq(shiftAssignments.shiftId, targetShift.id));
    if (assignmentsCount.length > 0) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot delete a shift that has active assignments. Drop assignments first, or cancel it.' } });
    }

    await db.delete(shifts).where(eq(shifts.id, req.params.id as string));
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('DELETE /shifts/:id error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete shift' } });
  }
});
