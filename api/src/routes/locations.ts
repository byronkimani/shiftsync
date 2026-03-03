import { Router } from 'express';
import { db } from '../db';
import { locations, userLocations } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireRole, requireLocationAccess } from '../middleware/rbac';
import { z } from 'zod';

export const locationsRouter = Router();

// Used in GET /locations for manager/staff filtering
// (We just use requireAuth to ensure they are logged in)
locationsRouter.get('/locations', requireAuth, async (req, res) => {
  try {
    const { role, locationIds } = req.auth!;
    
    let results;
    if (role === 'admin') {
      results = await db.select().from(locations);
    } else {
      if (locationIds.length === 0) {
        return res.json({ data: [] });
      }
      results = await db.select().from(locations).where(inArray(locations.id, locationIds));
    }

    res.json({ data: results });
  } catch (error) {
    console.error('GET /locations error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch locations' } });
  }
});

const createLocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  timezone: z.string().min(1),
  editCutoffHours: z.number().int().min(0).optional()
});

locationsRouter.post('/locations', requireRole('admin'), async (req, res) => {
  try {
    const parsed = createLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid payload' } });
    }

    const [location] = await db.insert(locations).values(parsed.data).returning();
    res.status(201).json({ data: location });
  } catch (error) {
    console.error('POST /locations error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create location' } });
  }
});

const updateLocationSchema = z.object({
  timezone: z.string().optional(),
  editCutoffHours: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
});

locationsRouter.patch('/locations/:id', requireRole('admin'), async (req, res) => {
  try {
    const parsed = updateLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid payload' } });
    }

    if (Object.keys(parsed.data).length === 0) {
      const [loc] = await db.select().from(locations).where(eq(locations.id, req.params.id as string));
      return res.json({ data: loc });
    }

    const [location] = await db.update(locations)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(locations.id, req.params.id as string))
      .returning();

    if (!location) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Location not found' } });
    }

    res.json({ data: location });
  } catch (error) {
    console.error('PATCH /locations error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update location' } });
  }
});
