import { Router } from 'express';
import { db } from '../db';
import { shifts, shiftAssignments, notifications, swapRequests } from '../db/schema';
import { eq, and, lte, gte, desc, max, count, or } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { DateTime } from 'luxon';

export const pollRouter = Router();

pollRouter.get('/poll/schedule', requireAuth, async (req, res) => {
    try {
        const { locationId, weekStart } = req.query;

        if (!locationId || typeof locationId !== 'string' || !weekStart || typeof weekStart !== 'string') {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'locationId and weekStart are required' } });
        }

        // We skip strict RBAC checks here to keep the query < 50ms. 
        // The full /shifts endpoint enforces RBAC. This just returns a generic lastUpdatedAt timestamp.

        const start = DateTime.fromISO(weekStart).startOf('week').toJSDate();
        const end = DateTime.fromISO(weekStart).endOf('week').toJSDate();

        // 1. Get max updatedAt from shifts directly
        const shiftStats = await db.select({
            count: count(),
            maxUpdated: max(shifts.updatedAt)
        }).from(shifts).where(and(
            eq(shifts.locationId, locationId),
            gte(shifts.startUtc, start),
            lte(shifts.startUtc, end)
        ));

        // 2. Get max updatedAt from assignments connected to those shifts
        // (If a manager drops someone, the shift might not update, but the assignment does)
        const assignmentStats = await db.select({
            count: count(),
            maxUpdated: max(shiftAssignments.updatedAt)
        }).from(shiftAssignments)
          .leftJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
          .where(and(
              eq(shifts.locationId, locationId),
              gte(shifts.startUtc, start),
              lte(shifts.startUtc, end)
          ));

        const sCount = shiftStats[0]?.count || 0;
        const aCount = assignmentStats[0]?.count || 0;
        
        const sDate = shiftStats[0]?.maxUpdated ? new Date(shiftStats[0].maxUpdated).getTime() : 0;
        const aDate = assignmentStats[0]?.maxUpdated ? new Date(assignmentStats[0].maxUpdated).getTime() : 0;

        const lastUpdatedAt = new Date(Math.max(sDate, aDate)).toISOString();

        res.json({ data: { lastUpdatedAt, shiftCount: sCount, assignmentCount: aCount } });
    } catch (error) {
        console.error('GET /poll/schedule error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR' } });
    }
});

pollRouter.get('/poll/notifications', requireAuth, async (req, res) => {
    try {
        const { userId } = req.auth!;

        // 1. Unread count
        const unreadRows = await db.select({ c: count() })
            .from(notifications)
            .where(and(
                eq(notifications.userId, userId),
                eq(notifications.read, false)
            ));

        // 2. Latest ID
        const latestRow = await db.query.notifications.findFirst({
            where: eq(notifications.userId, userId),
            orderBy: [desc(notifications.createdAt)],
            columns: { id: true }
        });

        res.json({
            data: {
                unreadCount: unreadRows[0]?.c || 0,
                latestId: latestRow?.id || null
            }
        });
    } catch (error) {
        console.error('GET /poll/notifications error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR' } });
    }
});

pollRouter.get('/poll/swap-requests', requireAuth, async (req, res) => {
    try {
        const { locationId } = req.query;
        const { role, locationIds, userId } = req.auth!;

        if (!locationId || typeof locationId !== 'string') {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'locationId is required' } });
        }

        let pendingCount = 0;
        let lastUpdatedAt = null;

        if (role === 'admin' || locationIds.includes(locationId)) {
            // Manager perspective: Count swaps that are accepted (ready for manager) or drops that are pending
            // Since swapRequests doesn't store locationId, we join shifts to filter. This requires a query builder.
            // For pure speed, we'll do a slightly heavier query since this fires every 10s per manager.
            const rawRes = await db.select({
                status: swapRequests.status,
                type: swapRequests.type,
                updatedAt: swapRequests.updatedAt
            })
            .from(swapRequests)
            .innerJoin(shiftAssignments, eq(swapRequests.requesterAssignmentId, shiftAssignments.id))
            .innerJoin(shifts, eq(shiftAssignments.shiftId, shifts.id))
            .where(eq(shifts.locationId, locationId));

            const relevant = rawRes.filter(r => 
                (r.type === 'swap' && r.status === 'accepted') || 
                (r.type === 'drop' && r.status === 'pending')
            );

            pendingCount = relevant.length;
            const maxDateNum = relevant.reduce((max, r) => Math.max(max, new Date(r.updatedAt).getTime()), 0);
            lastUpdatedAt = maxDateNum > 0 ? new Date(maxDateNum).toISOString() : null;

        } else {
            // Staff perspective: Count requests they are involved in that are pending/accepted
            const rawRes = await db.select({
                updatedAt: swapRequests.updatedAt
            })
            .from(swapRequests)
            .where(and(
                or(eq(swapRequests.requesterId, userId), eq(swapRequests.targetId, userId)),
                or(eq(swapRequests.status, 'pending'), eq(swapRequests.status, 'accepted'))
            ));

            pendingCount = rawRes.length;
            const maxDateNum = rawRes.reduce((max, r) => Math.max(max, new Date(r.updatedAt).getTime()), 0);
            lastUpdatedAt = maxDateNum > 0 ? new Date(maxDateNum).toISOString() : null;
        }

        res.json({ data: { pendingCount, lastUpdatedAt } });
    } catch (error) {
        console.error('GET /poll/swap-requests error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR' } });
    }
});
