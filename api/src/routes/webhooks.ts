import { Router, Request, Response } from 'express';
import express from 'express';
import { Webhook } from 'svix';
import { db } from '../db';
import { users, userLocations, auditLogs } from '../db/schema';
import { eq, notInArray } from 'drizzle-orm';

export const webhookRouter = Router();

// Clerk webhooks require the raw body for signature verification
webhookRouter.post('/clerk', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const SIGNATURE_HEADER = 'svix-signature';
  const TIMESTAMP_HEADER = 'svix-timestamp';
  const ID_HEADER = 'svix-id';

  const payload = req.body;
  const headers = req.headers;

  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) throw new Error('Missing CLERK_WEBHOOK_SECRET');

  const wh = new Webhook(secret);

  let evt: any;
  try {
    evt = wh.verify(payload, {
      "svix-id": headers[ID_HEADER] as string,
      "svix-timestamp": headers[TIMESTAMP_HEADER] as string,
      "svix-signature": headers[SIGNATURE_HEADER] as string,
    });
  } catch (err: any) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
  }

  const eventType = evt.type;
  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, first_name, last_name, email_addresses, public_metadata } = evt.data;
    
    const role = (public_metadata?.role as 'admin' | 'manager' | 'staff') || 'staff';
    const locationIds = (public_metadata?.locationIds as string[]) || [];
    const email = email_addresses[0]?.email_address || '';
    const name = `${first_name || ''} ${last_name || ''}`.trim() || 'Unknown User';

    try {
      await db.transaction(async (tx) => {
        // Find if user already exists by email (for seed data migration)
        const existingByEmail = await tx.query.users.findFirst({
          where: eq(users.email, email)
        });

        let user;
        if (existingByEmail && existingByEmail.clerkId.startsWith('seed_')) {
          // "Claim" the seed account by updating its clerkId
          [user] = await tx.update(users)
            .set({ clerkId: id, name, updatedAt: new Date() })
            .where(eq(users.id, existingByEmail.id))
            .returning();
        } else {
          // Normal Upsert User by clerkId
          [user] = await tx.insert(users).values({
            clerkId: id,
            name,
            email,
            role,
          }).onConflictDoUpdate({
            target: users.clerkId,
            set: { name, email, role, updatedAt: new Date() }
          }).returning();
        }

        if (!user) {
          throw new Error('Failed to create/link user');
        }

        // Sync Location Certifications
        if (locationIds.length > 0) {
          // Soft delete locations not in the array
          await tx.update(userLocations)
            .set({ isActive: false, revokedAt: new Date(), updatedAt: new Date() })
            .where(eq(userLocations.userId, user.id));

          // Upsert provided locations
          for (const locId of locationIds) {
            await tx.insert(userLocations).values({
              userId: user.id,
              locationId: locId,
              roleContext: role === 'manager' ? 'manager' : 'staff',
              isActive: true,
              revokedAt: null
            }).onConflictDoUpdate({
              target: [userLocations.userId, userLocations.locationId, userLocations.roleContext],
              set: { isActive: true, revokedAt: null, updatedAt: new Date() }
            });
          }
        }

        // Write Audit Log
        await tx.insert(auditLogs).values({
          entityType: 'user',
          entityId: user.id,
          action: eventType,
          actorId: user.id, 
          summary: `User ${eventType === 'user.created' ? 'created' : 'updated'} via Clerk webhook`
        });
      });
      
    } catch (err) {
      console.error('Webhook DB Error:', err);
      return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'DB Sync failed' } });
    }
  }

  res.status(200).json({ success: true });
});
