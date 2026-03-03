import { Router } from 'express';
import { db } from '../db';
import { users, userSkills, skills, userLocations, locations } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';

export const meRouter = Router();

meRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    
    // Fetch Skills
    const userSkillsResult = await db.select({
      id: skills.id,
      name: skills.name
    })
    .from(userSkills)
    .innerJoin(skills, eq(userSkills.skillId, skills.id))
    .where(eq(userSkills.userId, user.id));

    // Fetch Active Locations
    const userLocationsResult = await db.select({
      id: locations.id,
      name: locations.name,
      roleContext: userLocations.roleContext
    })
    .from(userLocations)
    .innerJoin(locations, eq(userLocations.locationId, locations.id))
    .where(and(eq(userLocations.userId, user.id), eq(userLocations.isActive, true)));

    res.json({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        desiredHoursPerWeek: user.desiredHoursPerWeek ? Number(user.desiredHoursPerWeek) : null,
        notificationPrefs: {
          inApp: user.notificationInApp,
          email: user.notificationEmail
        },
        skills: userSkillsResult,
        locations: userLocationsResult
      }
    });

  } catch (error) {
    console.error('GET /me error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch profile' } });
  }
});

meRouter.patch('/me', requireAuth, async (req, res) => {
  try {
    const { desiredHoursPerWeek, notificationPrefs } = req.body;
    
    const updateData: any = { updatedAt: new Date() };
    if (desiredHoursPerWeek !== undefined) updateData.desiredHoursPerWeek = String(desiredHoursPerWeek);
    if (notificationPrefs?.inApp !== undefined) updateData.notificationInApp = notificationPrefs.inApp;
    if (notificationPrefs?.email !== undefined) updateData.notificationEmail = notificationPrefs.email;

    const [updatedUser] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, req.user!.id))
      .returning();

    res.json({
      data: {
        id: updatedUser.id,
        desiredHoursPerWeek: updatedUser.desiredHoursPerWeek ? Number(updatedUser.desiredHoursPerWeek) : null,
        notificationPrefs: {
          inApp: updatedUser.notificationInApp,
          email: updatedUser.notificationEmail
        }
      }
    });
  } catch (error) {
    console.error('PATCH /me error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update profile' } });
  }
});
