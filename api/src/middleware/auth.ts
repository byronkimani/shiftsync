import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, userLocations } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuth } from '@clerk/express';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing authentication' } });
    }

    const clerkId = auth.userId; // Sub from Clerk JWT

    // Retrieve user and their active location certifications
    const userResult = await db.select({
      user: users,
      locationId: userLocations.locationId
    })
    .from(users)
    .leftJoin(
      userLocations, 
      and(
        eq(userLocations.userId, users.id),
        eq(userLocations.isActive, true)
      )
    )
    .where(eq(users.clerkId, clerkId));

    if (userResult.length === 0) {
      // User is authenticated in Clerk but not fully registered in DB via webhook yet
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found in local database' } });
    }

    const user = userResult[0].user;
    if (!user.isActive) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'User account is deactivated' } });
    }

    const locationIds = userResult
      .map(r => r.locationId)
      .filter((id): id is string => id !== null);

    req.user = user;
    req.auth = {
      userId: user.id,
      clerkId: user.clerkId,
      role: user.role,
      locationIds
    };

    next();
  } catch (error) {
    console.error('requireAuth Error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Authentication error' } });
  }
};
