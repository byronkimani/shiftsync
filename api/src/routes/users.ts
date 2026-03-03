import { Router } from 'express';
import { db } from '../db';
import { users, userLocations, userSkills, skills } from '../db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserService } from '../services/userService';
import { z } from 'zod';

export const usersRouter = Router();

usersRouter.get('/users', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { role, locationIds } = req.auth!;
    
    let query = db.select({
      user: users,
    })
    .from(users)
    .where(eq(users.isActive, true)); // default filter
    
    // Subquery or join for location filtering
    if (role === 'manager') {
      if (locationIds.length === 0) {
        return res.json({ data: [] });
      }
      query = db.select({ user: users })
        .from(users)
        .innerJoin(userLocations, eq(userLocations.userId, users.id))
        .where(
          and(
            eq(users.isActive, true),
            eq(userLocations.isActive, true),
            inArray(userLocations.locationId, locationIds)
          )
        );
    }

    const rows = await query;
    // Remove duplicates due to joins
    const uniqueUsers = Array.from(new Map(rows.map(r => [r.user.id, r.user])).values());

    const enrichedUsers = await Promise.all(
      uniqueUsers.map(u => UserService.getUserWithDetails(u.id))
    );

    // Manual filtering for query params
    let resultStream = enrichedUsers.filter(u => u !== null);
    
    if (req.query.role) {
      resultStream = resultStream.filter(u => u.role === req.query.role);
    }
    
    if (req.query.skillId) {
      resultStream = resultStream.filter(u => u.skills.some(s => s.id === req.query.skillId));
    }
    
    if (req.query.locationId && role === 'admin') {
      resultStream = resultStream.filter(u => u.locations.some(l => l.id === req.query.locationId));
    } else if (req.query.locationId && role === 'manager') {
      // Must ensure the manager actually manages this locationId requested
      if (!locationIds.includes(req.query.locationId as string)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this location' } });
      }
      resultStream = resultStream.filter(u => u.locations.some(l => l.id === req.query.locationId));
    }

    res.json({ data: resultStream });
  } catch (error) {
    console.error('GET /users error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch users' } });
  }
});

usersRouter.get('/users/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const user = await UserService.getUserWithDetails(req.params.id as string);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    // If manager, verify they share a location
    const { role, locationIds } = req.auth!;
    if (role === 'manager') {
      const sharesLocation = user.locations.some(l => locationIds.includes(l.id));
      if (!sharesLocation) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot access this user' } });
      }
    }

    res.json({ data: user });
  } catch (error) {
    console.error('GET /users/:id error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch user' } });
  }
});

const patchSkillsSchema = z.object({
  skillIds: z.array(z.string())
});

usersRouter.patch('/users/:id/skills', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const parsed = patchSkillsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid payload' } });
    }

    await db.transaction(async (tx) => {
      // Delete old skills
      await tx.delete(userSkills).where(eq(userSkills.userId, req.params.id as string));
      
      // Insert new skills
      if (parsed.data.skillIds.length > 0) {
        const inserts = parsed.data.skillIds.map(skillId => ({
          userId: req.params.id as string,
          skillId
        }));
        await tx.insert(userSkills).values(inserts);
      }
    });

    const updatedUser = await UserService.getUserWithDetails(req.params.id as string);
    res.json({ data: updatedUser });
  } catch (error) {
    console.error('PATCH /users/:id/skills error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update skills' } });
  }
});

const postLocationSchema = z.object({
  locationId: z.string(),
  roleContext: z.enum(['manager', 'staff'])
});

usersRouter.post('/users/:id/locations', requireRole('admin'), async (req, res) => {
  try {
    const parsed = postLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid payload' } });
    }

    const { locationId, roleContext } = parsed.data;

    const [ul] = await db.insert(userLocations).values({
      userId: req.params.id as string,
      locationId,
      roleContext,
      isActive: true,
      revokedAt: null
    }).onConflictDoUpdate({
      target: [userLocations.userId, userLocations.locationId, userLocations.roleContext],
      set: { isActive: true, revokedAt: null, updatedAt: new Date() }
    }).returning();

    res.status(201).json({ data: ul });
  } catch (error) {
    console.error('POST /users/:id/locations error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to certify user at location' } });
  }
});

usersRouter.delete('/users/:id/locations/:locationId', requireRole('admin'), async (req, res) => {
  try {
    const [ul] = await db.update(userLocations)
      .set({ isActive: false, revokedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(userLocations.userId, req.params.id as string),
        eq(userLocations.locationId, req.params.locationId as string)
      )).returning();

    if (!ul) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Active certification not found' } });
    }

    res.json({ data: { revokedAt: ul.revokedAt } });
  } catch (error) {
    console.error('DELETE /users/:id/locations error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to revoke location' } });
  }
});
