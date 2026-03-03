import { users } from '../db/schema';

type UserRow = typeof users.$inferSelect;

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        clerkId: string;
        role: string;
        locationIds: string[];
      };
      user?: UserRow;
    }
  }
}
