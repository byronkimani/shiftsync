import { db } from '../db';
import { users, shifts, userLocations, userSkills, availability, availabilityExceptions, shiftAssignments } from '../db/schema';
import { eq, and, getTableColumns } from 'drizzle-orm';
import { DateTime } from 'luxon';

export class EngineService {
  /**
   * Evaluates all 8 constraints for a given user and proposed shift.
   * Returns { eligible: boolean, reasons: string[] }
   */
  static async evaluateConstraints(userId: string, shiftId: string): Promise<{ eligible: boolean, reasons: string[] }> {
    const reasons: string[] = [];

    // 1. Fetch the target shift
    const targetShiftRow = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
      with: { location: true }
    });

    if (!targetShiftRow) {
      return { eligible: false, reasons: ['Shift not found'] };
    }

    // 2. Fetch the user
    const userRow = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userRow || !userRow.isActive) {
      return { eligible: false, reasons: ['User is inactive or not found'] };
    }

    const shiftTz = targetShiftRow.location.timezone;
    const sStart = DateTime.fromJSDate(targetShiftRow.startUtc).setZone(shiftTz);
    const sEnd = DateTime.fromJSDate(targetShiftRow.endUtc).setZone(shiftTz);

    // PRE-FETCH REQUIRED DATA IN PARALLEL
    const [
      activeLocCert,
      skillCert,
      userExceptions,
      userRecurringAvail,
      userAssignments
    ] = await Promise.all([
      db.query.userLocations.findFirst({
        where: and(eq(userLocations.userId, userId), eq(userLocations.locationId, targetShiftRow.locationId), eq(userLocations.isActive, true))
      }),
      db.query.userSkills.findFirst({
        where: and(eq(userSkills.userId, userId), eq(userSkills.skillId, targetShiftRow.skillId))
      }),
      db.query.availabilityExceptions.findMany({
        where: eq(availabilityExceptions.userId, userId)
      }),
      db.query.availability.findMany({
        where: and(eq(availability.userId, userId), eq(availability.locationId, targetShiftRow.locationId))
      }),
      // For assignments, we need all of them to check overlaps, limits, and rests.
      // Practically, fetching assignments over a ±3 week window is safe and exhaustive enough.
      db.query.shiftAssignments.findMany({
        where: and(
          eq(shiftAssignments.userId, userId),
          eq(shiftAssignments.status, 'assigned')
        ),
        with: {
          shift: true
        }
      })
    ]);

    // ==========================================
    // C1: Active Location Certification
    // ==========================================
    if (!activeLocCert) {
      reasons.push('User is not certified for this location');
    }

    // ==========================================
    // C2: Skill Match
    // ==========================================
    if (!skillCert) {
      reasons.push('User does not have the required skill for this shift');
    }

    // ==========================================
    // C3: Availability
    // ==========================================
    // Check exception first on this exact localized date
    const shiftDateStr = sStart.toFormat('yyyy-MM-dd');
    const exceptionForDay = userExceptions.find(e => e.date === shiftDateStr);
    
    let isAvailable = false;
    
    // Time helpers
    const shiftStartMin = sStart.hour * 60 + sStart.minute;
    const shiftEndMin = sEnd.hour * 60 + sEnd.minute;

    if (exceptionForDay) {
      if (!exceptionForDay.available) {
        reasons.push('User is marked unavailable (Exception/PTO) on this day');
      } else {
        // Must cover the whole shift
        const parseTimeStr = (t: string) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        if (exceptionForDay.startTime && exceptionForDay.endTime) {
            const availStartMin = parseTimeStr(exceptionForDay.startTime);
            const availEndMin = parseTimeStr(exceptionForDay.endTime);
            if (shiftStartMin >= availStartMin && shiftEndMin <= availEndMin) {
              isAvailable = true;
            } else {
              reasons.push('User exception availability does not entirely cover the shift hours');
            }
        }
      }
    } else {
      // Check recurring
      const dayOfWeek = sStart.weekday % 7; // luxon standard is 1=Mon, 7=Sun. Our DB is 0=Sun.
      const dbDayOfWeek = sStart.weekday === 7 ? 0 : sStart.weekday;

      const recurringForDay = userRecurringAvail.find(a => a.dayOfWeek === dbDayOfWeek);

      if (!recurringForDay) {
        reasons.push('User has no recurring availability on this day');
      } else {
        const parseTimeStr = (t: string) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        const availStartMin = parseTimeStr(recurringForDay.startTime);
        const availEndMin = parseTimeStr(recurringForDay.endTime);
        
        if (shiftStartMin >= availStartMin && shiftEndMin <= availEndMin) {
          isAvailable = true;
        } else {
          reasons.push('User recurring availability does not completely cover this shift');
        }
      }
    }

    // ==========================================
    // C4: Overlapping Shifts
    // ==========================================
    const hasOverlap = userAssignments.some(a => {
      const aStart = DateTime.fromJSDate(a.shift.startUtc);
      const aEnd = DateTime.fromJSDate(a.shift.endUtc);
      // overlap condition: max(start1, start2) < min(end1, end2)
      return (DateTime.max(sStart, aStart) < DateTime.min(sEnd, aEnd));
    });
    
    if (hasOverlap) {
      reasons.push('User already has an overlapping shift');
    }

    // ==========================================
    // C5: Weekly Hours Limit (+8 OT buffer)
    // ==========================================
    // Find week start/end in UTC matching the proposed shift.
    // Definition: Monday-based week for OT calculations.
    const propShiftUtcDate = DateTime.fromJSDate(targetShiftRow.startUtc);
    const weekStartUtc = propShiftUtcDate.startOf('week');
    const weekEndUtc = propShiftUtcDate.endOf('week');

    // Calculate sum of existing shifts in this week
    let weekAssignedHours = 0;
    for (const a of userAssignments) {
        const aStart = DateTime.fromJSDate(a.shift.startUtc);
        const aEnd = DateTime.fromJSDate(a.shift.endUtc);
        
        if (aStart >= weekStartUtc && aStart <= weekEndUtc) {
            weekAssignedHours += aEnd.diff(aStart, 'hours').hours;
        }
    }

    const proposedShiftHours = sEnd.diff(sStart, 'hours').hours;
    const baseDesired = userRow.desiredHoursPerWeek ? Number(userRow.desiredHoursPerWeek) : null;
    
    if (baseDesired !== null) {
        const maxAllowed = baseDesired + 8;
        if (weekAssignedHours + proposedShiftHours > maxAllowed) {
            reasons.push(`Adding this shift exceeds weekly hours limit (${maxAllowed}h allowed, currently assigned ${weekAssignedHours}h, proposed ${proposedShiftHours}h)`);
        }
    }

    // ==========================================
    // C6: Consecutive Days Limit (Max 5 days)
    // ==========================================
    // We check how many days in a row they are already working around the target date.
    // Build a set of all YYYY-MM-DD they work.
    const workedDaysSet = new Set<string>();
    for (const a of userAssignments) {
        const asLoc = DateTime.fromJSDate(a.shift.startUtc).setZone(shiftTz);
        workedDaysSet.add(asLoc.toFormat('yyyy-MM-dd'));
    }
    workedDaysSet.add(shiftDateStr);

    // To check if a 6-day chain gets formed, we search up to 5 days back and 5 days forward.
    let maxConsecutive = 0;
    
    for (let offset = -5; offset <= 0; offset++) {
        // We start a hypothetical run from shift_date + offset
        let consecutive = 0;
        let p = sStart.plus({ days: offset });
        
        // Count consecutive days from this starting position
        while (workedDaysSet.has(p.toFormat('yyyy-MM-dd'))) {
            consecutive++;
            p = p.plus({ days: 1 });
        }
        
        if (consecutive > maxConsecutive) {
            maxConsecutive = consecutive;
        }
    }

    if (maxConsecutive >= 6) {
        reasons.push('Assigning this shift results in working 6 or more consecutive days');
    }

    // ==========================================
    // C7: Premium Shift Equity
    // ==========================================
    if (targetShiftRow.isPremium) {
        // Need to find at least one non-premium shift the user worked at THIS location
        // in the previous 3 weeks.
        const threeWeeksAgo = sStart.minus({ weeks: 3 });
        
        const hasWorkedNormalShiftRecent = userAssignments.some(a => {
            const asStart = DateTime.fromJSDate(a.shift.startUtc).setZone(shiftTz);
            return (
                a.shift.locationId === targetShiftRow.locationId &&
                a.shift.isPremium === false &&
                asStart >= threeWeeksAgo &&
                asStart < sStart
            );
        });

        if (!hasWorkedNormalShiftRecent) {
            reasons.push('User must work a non-premium shift at this location in the last 3 weeks before taking a premium shift');
        }
    }

    // ==========================================
    // C8: Rest Period (10+ hours between shifts)
    // ==========================================
    const hasInsufficientRest = userAssignments.some(a => {
        const aStart = DateTime.fromJSDate(a.shift.startUtc);
        const aEnd = DateTime.fromJSDate(a.shift.endUtc);
        
        // The proposed shift is either immediately AFTER the assigned shift,
        // or immediately BEFORE it.
        // If sStart >= aEnd => proposed shift is AFTER. The gap is sStart - aEnd.
        if (sStart >= aEnd) {
            return sStart.diff(aEnd, 'hours').hours < 10;
        }
        
        // If sEnd <= aStart => proposed shift is BEFORE. The gap is aStart - sEnd.
        if (sEnd <= aStart) {
            return aStart.diff(sEnd, 'hours').hours < 10;
        }
        
        return false; // overlap case handled by C4
    });

    if (hasInsufficientRest) {
        reasons.push('User does not have at least 10 hours of rest between shifts');
    }

    return {
      eligible: reasons.length === 0,
      reasons
    };
  }
}
