import { Router } from 'express';
import { db } from '../db';
import { swapRequests, shiftAssignments, shifts, users } from '../db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { EngineService } from '../services/engineService';
import { NotificationService } from '../services/notificationService';
import { AuditService } from '../services/auditService';
import { z } from 'zod';
import { DateTime } from 'luxon';

export const swapsRouter = Router();

const createRequestSchema = z.object({
  type: z.enum(['swap', 'drop']),
  requesterAssignmentId: z.string().uuid(),
  targetAssignmentId: z.string().uuid().optional()
}).refine(data => {
  if (data.type === 'swap' && !data.targetAssignmentId) return false;
  if (data.type === 'drop' && data.targetAssignmentId) return false;
  return true;
}, "Swap requires targetAssignmentId. Drop must not have one.");

swapsRouter.post('/swap-requests', requireAuth, async (req, res) => {
  try {
    const parsed = createRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid payload', details: parsed.error.issues } });
    }

    const { userId } = req.auth!;
    const { type, requesterAssignmentId, targetAssignmentId } = parsed.data;

    // Fetch requester assignment
    const reqAssignmentRow = await db.query.shiftAssignments.findFirst({
        where: eq(shiftAssignments.id, requesterAssignmentId),
        with: { shift: { with: { location: true } } }
    });

    if (!reqAssignmentRow || reqAssignmentRow.userId !== userId) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Your assignment was not found' } });
    }

    if (reqAssignmentRow.status !== 'assigned') {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Assignment is no longer active' } });
    }

    // Edit cutoff check
    const shiftStart = DateTime.fromJSDate(reqAssignmentRow.shift.startUtc);
    const now = DateTime.utc();
    const cutoffHours = reqAssignmentRow.shift.location.editCutoffHours;
    if (shiftStart.diff(now, 'hours').hours < cutoffHours) {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: `Cannot request changes within ${cutoffHours} hours of shift start` } });
    }

    let targetUserId = null;

    if (type === 'swap' && targetAssignmentId) {
        const tgtAssignmentRow = await db.query.shiftAssignments.findFirst({
            where: eq(shiftAssignments.id, targetAssignmentId),
            with: { shift: true }
        });

        if (!tgtAssignmentRow) {
            return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Target assignment not found' } });
        }

        if (tgtAssignmentRow.userId === userId) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot swap with yourself' } });
        }

        if (tgtAssignmentRow.shift.locationId !== reqAssignmentRow.shift.locationId) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cannot swap shifts across different locations' } });
        }

        targetUserId = tgtAssignmentRow.userId;
    }

    if (type === 'drop') {
      const hoursUntilShift = shiftStart.diff(now, 'hours').hours;
      if (hoursUntilShift < 24) {
        return res.status(422).json({ error: { code: 'BAD_REQUEST', message: 'Drop requests require at least 24 hours notice' } });
      }
    }

    // Check maximum 3 pending requests limit
    const existingPending = await db.select({ id: swapRequests.id })
       .from(swapRequests)
       .where(and(eq(swapRequests.requesterId, userId), eq(swapRequests.status, 'pending')));
       
    if (existingPending.length >= 3) {
       return res.status(422).json({ error: { code: 'BAD_REQUEST', message: 'You have reached the limit of 3 pending requests' } });
    }

    const [newReq] = await db.insert(swapRequests).values({
        type,
        requesterAssignmentId,
        targetAssignmentId: targetAssignmentId || null,
        requesterId: userId,
        targetId: targetUserId,
        status: 'pending',
        updatedAt: new Date()
    }).returning();

    if (targetUserId) {
        await NotificationService.notify(
            targetUserId, 
            'swap_request_received', 
            `You have received a new swap request from a peer.`
        );
    }

    res.status(201).json({ data: newReq });
  } catch (error) {
    console.error('POST /swap-requests error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create request' } });
  }
});

swapsRouter.get('/swap-requests', requireAuth, async (req, res) => {
    try {
      const { userId, role, locationIds } = req.auth!;
      
      let query;
  
      if (role === 'staff') {
        // Staff see requests they initiated or are targeted by
        query = db.query.swapRequests.findMany({
            where: or(
                eq(swapRequests.requesterId, userId),
                eq(swapRequests.targetId, userId)
            ),
            with: {
                requesterAssignment: { with: { shift: true } },
                targetAssignment: { with: { shift: true } }
            },
            orderBy: (swapRequests, { desc }) => [desc(swapRequests.createdAt)]
        });
      } else {
        // Admins/Managers see all pending/accepted for their locations
        // This requires a join to shifts through the assignments.
        // For simplicity, we fetch assignments for the user's locations, then filter swap requests
        // A direct join is better using Drizzle relational queries.
        query = db.query.swapRequests.findMany({
            where: inArray(swapRequests.status, ['pending', 'accepted']),
            with: {
                requesterAssignment: { with: { shift: true } },
                targetAssignment: { with: { shift: true } }
            },
            orderBy: (swapRequests, { desc }) => [desc(swapRequests.createdAt)]
        });
      }
  
      let results = await query;

      // Manual filtering for managers based on location
      if (role === 'manager') {
         results = results.filter(r => {
             // TS requires null check on relations but DB constraint guarantees requesterAssignment exists
             const shiftLocId = r.requesterAssignment?.shift?.locationId;
             return shiftLocId && locationIds.includes(shiftLocId);
         });
      }
  
      res.json({ data: results });
    } catch (error) {
      console.error('GET /swap-requests error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch requests' } });
    }
});

const peerActionSchema = z.object({
   action: z.enum(['accept', 'reject']) 
});

swapsRouter.patch('/swap-requests/:id/peer', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.auth!;
        
        const parsed = peerActionSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid action' } });
        }
        
        const swapReq = await db.query.swapRequests.findFirst({ where: eq(swapRequests.id, id as string) });
        if (!swapReq) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } });

        if (swapReq.targetId !== userId) {
            return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not the target of this request' } });
        }

        if (swapReq.status !== 'pending') {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Request is no longer pending' } });
        }

        const newStatus = parsed.data.action === 'accept' ? 'accepted' : 'cancelled';
        const reason = parsed.data.action === 'reject' ? 'Rejected by peer' : null;

        const [updated] = await db.update(swapRequests)
           .set({ status: newStatus, cancellationReason: reason, updatedAt: new Date(), resolvedAt: newStatus === 'cancelled' ? new Date() : null })
           .where(eq(swapRequests.id, id as string))
           .returning();

        // Notify Requester of peer's decision
        await NotificationService.notify(
          swapReq.requesterId,
          `swap_${newStatus}`,
          `Your swap request has been ${newStatus} by your peer.`
        );

        res.json({ data: updated });
    } catch (error) {
        console.error('PATCH /swap-requests/:id/peer error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to process peer action' } });
    }
});

swapsRouter.post('/swap-requests/:id/withdraw', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.auth!;
        
        const swapReq = await db.query.swapRequests.findFirst({ where: eq(swapRequests.id, id as string) });
        if (!swapReq) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } });

        if (swapReq.requesterId !== userId) {
            return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the requester can withdraw this request' } });
        }

        if (swapReq.status !== 'pending' && swapReq.status !== 'accepted') {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Request cannot be withdrawn in its current state' } });
        }

        const [updated] = await db.update(swapRequests)
           .set({ status: 'cancelled', cancellationReason: 'requester_withdrew', updatedAt: new Date(), resolvedAt: new Date() })
           .where(eq(swapRequests.id, id as string))
           .returning();

        // If it was already accepted by target, notify them it was withdrawn
        if (swapReq.status === 'accepted' && swapReq.targetId) {
            await NotificationService.notify(
                swapReq.targetId,
                'swap_withdrawn',
                'The requester has withdrawn their swap request.'
            );
        }

        res.json({ data: updated });
    } catch (error) {
        console.error('POST /swap-requests/:id/withdraw error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to withdraw request' } });
    }
});

const managerActionSchema = z.object({
    action: z.enum(['approve', 'reject']),
    reason: z.string().optional()
});

swapsRouter.patch('/swap-requests/:id/manager', requireRole('admin', 'manager'), async (req, res) => {
    try {
        const { id } = req.params;
        const { userId: managerId, role, locationIds } = req.auth!;

        const parsed = managerActionSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid action' } });

        const swapReq = await db.query.swapRequests.findFirst({
            where: eq(swapRequests.id, id as string),
            with: { requesterAssignment: { with: { shift: true } } }
        });

        if (!swapReq) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Request not found' } });

        // RBAC on Location
        const shiftLocId = swapReq.requesterAssignment.shift.locationId;
        if (role !== 'admin' && !locationIds.includes(shiftLocId)) {
            return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot manage requests for this location' } });
        }

        // Drops can be approved from `pending`. Swaps must be `accepted` by peer first.
        if (swapReq.type === 'drop' && swapReq.status !== 'pending') {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Drop request is not pending' } });
        }
        if (swapReq.type === 'swap' && swapReq.status !== 'accepted') {
            return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Swap request must be accepted by peer first' } });
        }

        if (parsed.data.action === 'reject') {
            const [updated] = await db.update(swapRequests)
                .set({ status: 'cancelled', cancellationReason: parsed.data.reason || 'Rejected by manager', managerId, updatedAt: new Date(), resolvedAt: new Date() })
                .where(eq(swapRequests.id, id as string))
                .returning();

            // Notify Requester and Target of manager rejection
            await NotificationService.notify(swapReq.requesterId, 'swap_rejected_manager', 'Your request was rejected by a manager.');
            if (swapReq.targetId) {
                await NotificationService.notify(swapReq.targetId, 'swap_rejected_manager', 'A swap request involving you was rejected by a manager.');
            }

            return res.json({ data: updated });
        }

        // Action is APPROVE
        if (swapReq.type === 'drop') {
            // Transaction: Drop the assignment, mark request complete
            await db.transaction(async (tx) => {
                await tx.update(shiftAssignments)
                    .set({ status: 'dropped', updatedAt: new Date() })
                    .where(eq(shiftAssignments.id, swapReq.requesterAssignmentId));
                
                await tx.update(swapRequests)
                    .set({ status: 'approved', managerId, updatedAt: new Date(), resolvedAt: new Date() })
                    .where(eq(swapRequests.id, id as string));
            });

            // Log drop to Audit Trail
            await AuditService.log(
                'shift',
                swapReq.requesterAssignment.shiftId,
                'ASSIGNMENT_DROPPED',
                { assignmentId: swapReq.requesterAssignmentId, userId: swapReq.requesterId },
                { status: 'dropped', reason: 'Swap drop approved' },
                managerId
            );
        } else if (swapReq.type === 'swap') {
            // Need to verify both assignments still exist and run Engine check for BOTH bounds.
            const tgtAssignmentRow = await db.query.shiftAssignments.findFirst({ where: eq(shiftAssignments.id, swapReq.targetAssignmentId!) });
            
            if (!tgtAssignmentRow || tgtAssignmentRow.status !== 'assigned' || swapReq.requesterAssignment.status !== 'assigned') {
               return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'One or both shifts are no longer assigned' } });
            }

            // Engine check 1: Target User taking Requester Shift
            const check1 = await EngineService.evaluateConstraints(tgtAssignmentRow.userId, swapReq.requesterAssignment.shiftId);
            if (!check1.valid) {
                return res.status(400).json({ error: { code: 'CONSTRAINT_VIOLATION', message: 'Target user is not eligible for requester shift', details: check1.violations }});
            }

            // Engine check 2: Requester User taking Target Shift
            const check2 = await EngineService.evaluateConstraints(swapReq.requesterId, tgtAssignmentRow.shiftId);
            if (!check2.valid) {
                return res.status(400).json({ error: { code: 'CONSTRAINT_VIOLATION', message: 'Requester user is not eligible for target shift', details: check2.violations }});
            }

            // Transaction: Swap the userIds on the assignments
            await db.transaction(async (tx) => {
                // To avoid unique constraint conflicts (if they were both identical shifts, though engine checks overlap), we update carefully.
                await tx.update(shiftAssignments)
                    .set({ userId: tgtAssignmentRow.userId, assignedBy: managerId, updatedAt: new Date() })
                    .where(eq(shiftAssignments.id, swapReq.requesterAssignmentId));
                
                await tx.update(shiftAssignments)
                    .set({ userId: swapReq.requesterId, assignedBy: managerId, updatedAt: new Date() })
                    .where(eq(shiftAssignments.id, swapReq.targetAssignmentId!));

                await tx.update(swapRequests)
                    .set({ status: 'approved', managerId, updatedAt: new Date(), resolvedAt: new Date() })
                    .where(eq(swapRequests.id, id as string));
            });

            // Log both swaps to Audit Trail
            await AuditService.log('shift', swapReq.requesterAssignment.shiftId, 'ASSIGNMENT_SWAPPED', 
                { userId: swapReq.requesterId }, { userId: tgtAssignmentRow.userId }, managerId);
                
            await AuditService.log('shift', tgtAssignmentRow.shiftId, 'ASSIGNMENT_SWAPPED', 
                { userId: tgtAssignmentRow.userId }, { userId: swapReq.requesterId }, managerId);
        }

        const [finalReq] = await db.select().from(swapRequests).where(eq(swapRequests.id, id as string));

        // Notify success
        await NotificationService.notify(swapReq.requesterId, 'swap_approved', 'Your shift request was approved by a manager and your schedule has been updated.');
        if (swapReq.targetId) {
            await NotificationService.notify(swapReq.targetId, 'swap_approved', 'Your shift swap was approved and your schedule has been updated.');
        }

        res.json({ data: finalReq });

    } catch (error) {
        console.error('PATCH /swap-requests/:id/manager error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to process manager action' } });
    }
});
