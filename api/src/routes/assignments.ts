import { Router } from 'express';
import { db } from '../db';
import { shiftAssignments, shifts } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { EngineService } from '../services/engineService';
import { AuditService } from '../services/auditService';
import { z } from 'zod';

export const assignmentsRouter = Router({ mergeParams: true });

// Note: Mounted at /api/shifts/:shiftId/assignments

const postAssignmentSchema = z.object({
  userId: z.string().uuid()
});

assignmentsRouter.post('/', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const shiftId = req.params.shiftId as string;
    
    const parsed = postAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid payload' } });
    }
    const staffUserId = parsed.data.userId;

    const targetShift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
    if (!targetShift) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift not found' } });

    // RBAC
    const { role, locationIds, userId: authorId } = req.auth!;
    if (role !== 'admin' && !locationIds.includes(targetShift.locationId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot manage assignments for this shift' } });
    }

    // Prevent over-assigning
    const currentAssignments = await db.select({ id: shiftAssignments.id })
      .from(shiftAssignments)
      .where(and(eq(shiftAssignments.shiftId, shiftId), eq(shiftAssignments.status, 'assigned')));
    
    if (currentAssignments.length >= targetShift.headcountRequired) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Shift headcount is already fully met' } });
    }

    // Call Constraint Engine
    const evalResult = await EngineService.evaluateConstraints(staffUserId, shiftId);
    if (!evalResult.eligible) {
      return res.status(400).json({ 
        error: { 
          code: 'CONSTRAINT_VIOLATION', 
          message: 'User is not eligible for this shift', 
          details: evalResult.reasons 
        } 
      });
    }

    const [newAssignment] = await db.insert(shiftAssignments).values({
      shiftId,
      userId: staffUserId,
      assignedBy: req.auth!.userId,
      status: 'assigned',
      version: 1,
      updatedAt: new Date()
    }).returning();

    // Log to Audit Trail
    await AuditService.log(
      'shift', 
      shiftId, 
      'ASSIGNMENT_CREATED', 
      null, 
      { assignmentId: newAssignment.id, userId: staffUserId }, 
      req.auth!.userId
    );

    res.status(201).json({ data: newAssignment });
  } catch (error: any) {
    if (error.code === '23505') { // Postgres unique_violation
       return res.status(400).json({ error: { code: 'CONFLICT', message: 'User is already assigned to this shift' } });
    }
    console.error('POST /assignments error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create assignment' } });
  }
});

assignmentsRouter.delete('/:userId', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const shiftId = req.params.shiftId as string;
    const userId = req.params.userId as string;

    const targetShift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) });
    if (!targetShift) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shift not found' } });

    const { role, locationIds } = req.auth!;
    if (role !== 'admin' && !locationIds.includes(targetShift.locationId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Cannot drop assignments for this shift' } });
    }

    // Find the assignment first to get its ID for logging
    const targetAssignment = await db.query.shiftAssignments.findFirst({
      where: and(
        eq(shiftAssignments.shiftId, shiftId),
        eq(shiftAssignments.userId, userId)
      )
    });

    if (!targetAssignment) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }

    const [deleted] = await db.delete(shiftAssignments)
      .where(eq(shiftAssignments.id, targetAssignment.id))
      .returning();

    if (!deleted) {
      // This case should ideally not be hit if targetAssignment was found,
      // but keeping for robustness against race conditions or other DB issues.
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assignment not found after attempting deletion' } });
    }

    // Log to Audit Trail
    await AuditService.log(
      'shift', 
      shiftId, 
      'ASSIGNMENT_DROPPED', 
      { assignmentId: targetAssignment.id, userId, status: 'assigned' }, 
      { status: 'dropped' }, 
      req.auth!.userId
    );

    res.json({ success: true, data: { id: targetAssignment.id, status: 'dropped' } });
  } catch (error) {
    console.error('DELETE /assignments/:userId error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to drop assignment' } });
  }
});
