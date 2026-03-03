import { Router } from 'express';
import { db } from '../db';
import { shifts, shiftAssignments } from '../db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { requireRole } from '../middleware/rbac';

export const ondutyRouter = Router();

ondutyRouter.get('/on-duty', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { locationId } = req.query;

        if (!locationId || typeof locationId !== 'string') {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'locationId is required' } });
        }

        // RBAC logic
        const { role, locationIds } = req.auth!;
        if (role !== 'admin' && !locationIds.includes(locationId)) {
            return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No access to this location' } });
        }

        const now = new Date();

        // Find shifts currently active
        const activeShifts = await db.query.shifts.findMany({
            where: and(
                eq(shifts.locationId, locationId),
                eq(shifts.status, 'published'),
                lte(shifts.startUtc, now),
                gte(shifts.endUtc, now)
            ),
            with: {
                assignments: {
                    where: eq(shiftAssignments.status, 'assigned'),
                    with: {
                        user: { columns: { id: true, name: true, role: true } }
                    }
                }
            }
        });

        // Flatten assignments into a list of users
        const onDutyStaff: any[] = [];
        for (const shift of activeShifts) {
            for (const assignment of shift.assignments) {
                onDutyStaff.push({
                    userId: assignment.user.id,
                    name: assignment.user.name,
                    role: assignment.user.role,
                    shiftId: shift.id,
                    shiftStartUtc: shift.startUtc,
                    shiftEndUtc: shift.endUtc
                });
            }
        }

        res.json({ data: onDutyStaff });
    } catch (error) {
        console.error('GET /on-duty error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch on-duty staff' } });
    }
});
