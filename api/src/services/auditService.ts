import { db } from '../db';
import { auditLogs } from '../db/schema';
import { v4 as uuidv4 } from 'uuid';

export class AuditService {
  /**
   * Logs an action with before and after state to the audit_logs table.
   */
  static async log(
    entityType: string,
    entityId: string,
    action: string,
    beforeState: any,
    afterState: any,
    actorId: string,
    ipAddress?: string
  ) {
    try {
      const summary = AuditService.getSummary(entityType, action, beforeState, afterState);

      await db.insert(auditLogs).values({
        id: uuidv4(),
        entityType,
        entityId,
        action,
        beforeState: beforeState || null,
        afterState: afterState || null,
        actorId,
        ipAddress: ipAddress || null,
        summary
      });
    } catch (error) {
      console.error('AuditService.log error:', error);
      // Suppress to avoid failing the main transaction if logging fails,
      // though in strict systems this would be fatal.
    }
  }

  /**
   * Generates a single-line summary string for the CSV export.
   */
  static getSummary(entityType: string, action: string, beforeState: any, afterState: any): string {
    switch (action) {
      case 'SHIFT_CREATED':
        return `Shift created with headcount ${afterState?.headcountRequired}`;
      case 'SHIFT_PUBLISHED':
        return `Shift published.`;
      case 'SHIFT_UPDATED':
        return `Shift updated.`;
      case 'SHIFT_DELETED':
        return `Shift deleted.`;
      case 'ASSIGNMENT_CREATED':
        return `Staff assigned to shift.`;
      case 'ASSIGNMENT_DROPPED':
        return `Staff dropped from shift.`;
      case 'ASSIGNMENT_SWAPPED':
          return `Shift reassigned/swapped.`;
      default:
        return `${entityType} ${action}`;
    }
  }
}
