import { Router } from 'express';
import { db } from '../db';
import { shifts, shiftAssignments, users, userLocations } from '../db/schema';
import { eq, and, lte, gte, inArray } from 'drizzle-orm';
import { requireRole } from '../middleware/rbac';
import { z } from 'zod';
import { DateTime } from 'luxon';

export const analyticsRouter = Router();

analyticsRouter.get('/analytics/overtime', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { locationId, weekStart } = req.query;

    if (!locationId || typeof locationId !== 'string' || !weekStart || typeof weekStart !== 'string') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'locationId and weekStart are required' } });
    }

    const { role, locationIds } = req.auth!;
    if (role !== 'admin' && !locationIds.includes(locationId)) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No access to this location' } });
    }

    const start = DateTime.fromISO(weekStart).startOf('week');
    const end = start.endOf('week');

    // Fetch all assignments for this location and week
    const targetShifts = await db.query.shifts.findMany({
      where: and(
        eq(shifts.locationId, locationId),
        gte(shifts.startUtc, start.toJSDate()),
        lte(shifts.startUtc, end.toJSDate()),
        inArray(shifts.status, ['published', 'draft']) // Both count towards scheduled hours
      ),
      with: {
        assignments: {
          where: eq(shiftAssignments.status, 'assigned'),
          with: { user: true }
        }
      }
    });

    const staffMap = new Map<string, any>();
    let totalProjectedOvertimeHours = 0;

    // Process shifts chronologically to accurately flag the exact assignments crossing the 40h mark
    const sortedShifts = targetShifts.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());

    for (const shift of sortedShifts) {
      const durationHours = (shift.endUtc.getTime() - shift.startUtc.getTime()) / (1000 * 60 * 60);

      for (const assignment of shift.assignments) {
        const uId = assignment.userId;
        if (!staffMap.has(uId)) {
          staffMap.set(uId, {
            userId: uId,
            name: assignment.user.name,
            scheduledHours: 0,
            overtimeHours: 0,
            overtimeAssignments: []
          });
        }

        const staffRecord = staffMap.get(uId);
        const previousTotal = staffRecord.scheduledHours;
        const newTotal = previousTotal + durationHours;
        
        staffRecord.scheduledHours = newTotal;

        if (newTotal > 40) {
           const otHoursFromThisShift = newTotal - Math.max(40, previousTotal);
           staffRecord.overtimeHours += otHoursFromThisShift;
           staffRecord.overtimeAssignments.push({
               shiftId: shift.id,
               startUtc: shift.startUtc,
               durationContributed: otHoursFromThisShift
           });
           totalProjectedOvertimeHours += otHoursFromThisShift;
        }
      }
    }

    res.json({
        data: {
            totalProjectedOvertimeHours,
            staff: Array.from(staffMap.values())
        }
    });

  } catch (error) {
    console.error('GET /analytics/overtime error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate overtime report' } });
  }
});

analyticsRouter.get('/analytics/fairness', requireRole('admin', 'manager'), async (req, res) => {
    try {
      const { locationId, from, to } = req.query;
  
      if (!locationId || typeof locationId !== 'string' || !from || typeof from !== 'string' || !to || typeof to !== 'string') {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'locationId, from, and to are required' } });
      }
  
      const { role, locationIds } = req.auth!;
      if (role !== 'admin' && !locationIds.includes(locationId)) {
          return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No access to this location' } });
      }
  
      const fromDate = new Date(from);
      const toDate = new Date(to);
  
      // Get all active staff at this location
      const eligibleStaffRecords = await db.query.userLocations.findMany({
          where: and(
              eq(userLocations.locationId, locationId),
              eq(userLocations.isActive, true),
              eq(userLocations.roleContext, 'staff')
          ),
          with: { user: true }
      });

      const eligibleStaffMap = new Map();
      for (const record of eligibleStaffRecords) {
          eligibleStaffMap.set(record.userId, {
              userId: record.userId,
              name: record.user.name,
              premiumShiftsWorked: 0
          });
      }

      const eligibleStaffCount = eligibleStaffMap.size;
  
      // Fetch all premium assignments for this location in range
      const premiumShifts = await db.query.shifts.findMany({
        where: and(
          eq(shifts.locationId, locationId),
          eq(shifts.isPremium, true),
          gte(shifts.startUtc, fromDate),
          lte(shifts.startUtc, toDate),
          inArray(shifts.status, ['published', 'draft'])
        ),
        with: {
          assignments: { where: eq(shiftAssignments.status, 'assigned') }
        }
      });
  
      let totalPremiumShifts = 0;
  
      for (const shift of premiumShifts) {
        for (const assignment of shift.assignments) {
          totalPremiumShifts++;
          if (eligibleStaffMap.has(assignment.userId)) {
             eligibleStaffMap.get(assignment.userId).premiumShiftsWorked++;
          }
        }
      }
      
      const expectedSharePerPerson = eligibleStaffCount > 0 ? totalPremiumShifts / eligibleStaffCount : 0;
      
      const staffResults = Array.from(eligibleStaffMap.values()).map(staff => {
         const deviation = staff.premiumShiftsWorked - expectedSharePerPerson;
         const deviationPct = expectedSharePerPerson > 0 ? (deviation / expectedSharePerPerson) * 100 : 0;
         // Flag if deviation is > 20% of expected (if expected > 0), typically negative for underserved
         const flagged = expectedSharePerPerson > 0 ? (Math.abs(deviation / expectedSharePerPerson) > 0.20) : false;
         
         return {
             ...staff,
             deviation,
             deviationPct,
             flagged
         };
      });
  
      res.json({
          data: {
              period: { from, to },
              eligibleStaffCount,
              totalPremiumShifts,
              expectedSharePerPerson,
              staff: staffResults
          }
      });
  
    } catch (error) {
      console.error('GET /analytics/fairness error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate fairness report' } });
    }
});

analyticsRouter.get('/analytics/distribution', requireRole('admin', 'manager'), async (req, res) => {
    try {
      const { locationId, from, to } = req.query;
  
      if (!locationId || typeof locationId !== 'string' || !from || typeof from !== 'string' || !to || typeof to !== 'string') {
        return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'locationId, from, and to are required' } });
      }
  
      const { role, locationIds } = req.auth!;
      if (role !== 'admin' && !locationIds.includes(locationId)) {
          return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No access to this location' } });
      }
  
      const fromDate = new Date(from);
      const toDate = new Date(to);
  
      // Get all active staff at this location to ensure we list people even with 0 scheduled hours
      const activeStaffRecords = await db.query.userLocations.findMany({
          where: and(
              eq(userLocations.locationId, locationId),
              eq(userLocations.isActive, true),
              eq(userLocations.roleContext, 'staff')
          ),
          with: { user: true }
      });

      const distributionMap = new Map();
      for (const record of activeStaffRecords) {
          const rawDesired = record.user.desiredHoursPerWeek;
          distributionMap.set(record.userId, {
              userId: record.userId,
              name: record.user.name,
              desiredHours: rawDesired != null ? parseFloat(rawDesired.toString()) : null,
              scheduledHours: 0,
              delta: 0
          });
      }
  
      // Fetch all assignments for this location in range
      const targetShifts = await db.query.shifts.findMany({
        where: and(
          eq(shifts.locationId, locationId),
          gte(shifts.startUtc, fromDate),
          lte(shifts.startUtc, toDate),
          inArray(shifts.status, ['published', 'draft'])
        ),
        with: {
          assignments: { where: eq(shiftAssignments.status, 'assigned') }
        }
      });
  
      for (const shift of targetShifts) {
        const durationHours = (shift.endUtc.getTime() - shift.startUtc.getTime()) / (1000 * 60 * 60);

        for (const assignment of shift.assignments) {
            if (distributionMap.has(assignment.userId)) {
                distributionMap.get(assignment.userId).scheduledHours += durationHours;
            }
        }
      }
      
      const staffResults = Array.from(distributionMap.values()).map(staff => {
         return {
             ...staff,
             delta: staff.desiredHours != null ? staff.scheduledHours - staff.desiredHours : null
         };
      });
  
      res.json({ data: staffResults });
  
    } catch (error) {
      console.error('GET /analytics/distribution error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate distribution report' } });
    }
});
