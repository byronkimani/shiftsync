import { db } from '../db';
import { users, userSkills, skills, userLocations, locations } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export class UserService {
  static async getUserWithDetails(userId: string) {
    const userResult = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userResult) return null;

    // Fetch Skills
    const skillsList = await db.select({
      id: skills.id,
      name: skills.name
    })
    .from(userSkills)
    .innerJoin(skills, eq(userSkills.skillId, skills.id))
    .where(eq(userSkills.userId, userId));

    // Fetch Active Locations
    const locationsList = await db.select({
      id: locations.id,
      name: locations.name,
      roleContext: userLocations.roleContext
    })
    .from(userLocations)
    .innerJoin(locations, eq(userLocations.locationId, locations.id))
    .where(and(eq(userLocations.userId, userId), eq(userLocations.isActive, true)));

    return {
      ...userResult,
      skills: skillsList,
      locations: locationsList
    };
  }
}
