import { db } from '../db';
import { users, shifts, userLocations, userSkills, availability, availabilityExceptions, shiftAssignments } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { DateTime } from 'luxon';

export interface ValidationViolation {
  code: string;
  message: string;
  data?: any;
}

export class EngineService {
  /**
   * Evaluates all constraints for a given user and proposed shift.
   */
  static async evaluateConstraints(userId: string, shiftId: string): Promise<{ valid: boolean, violations: ValidationViolation[], warnings: ValidationViolation[], suggestions: any[] }> {
    const violations: ValidationViolation[] = [];
    const warnings: ValidationViolation[] = [];

    // 1. Fetch the target shift
    const targetShiftRow = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
      with: { location: true, skill: true }
    });

    if (!targetShiftRow) {
      violations.push({ code: 'SHIFT_NOT_FOUND', message: 'Shift not found' });
      return { valid: false, violations, warnings, suggestions: [] };
    }

    // 2. Fetch the user
    const userRow = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userRow || !userRow.isActive) {
      violations.push({ code: 'USER_INVALID', message: 'User is inactive or not found' });
      return { valid: false, violations, warnings, suggestions: [] };
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
      db.query.shiftAssignments.findMany({
        where: and(
          eq(shiftAssignments.userId, userId),
          eq(shiftAssignments.status, 'assigned')
        ),
        with: {
          shift: { with: { location: true } }
        }
      })
    ]);

    // ==========================================
    // C1: Active Location Certification
    // ==========================================
    if (!activeLocCert) {
      violations.push({ code: 'LOCATION_NOT_CERTIFIED', message: `User is not certified at ${targetShiftRow.location.name}` });
    }

    // ==========================================
    // C2: Skill Match
    // ==========================================
    if (!skillCert) {
      violations.push({ code: 'SKILL_MISMATCH', message: `User does not have the required skill (${targetShiftRow.skill.name}) for this shift` });
    }

    // ==========================================
    // C3: Availability
    // ==========================================
    const shiftDateStr = sStart.toFormat('yyyy-MM-dd');
    const exceptionForDay = userExceptions.find(e => e.date === shiftDateStr);
    
    const shiftStartMin = sStart.hour * 60 + sStart.minute;
    const shiftEndMin = sEnd.hour * 60 + sEnd.minute;

    if (exceptionForDay) {
      if (!exceptionForDay.available) {
        violations.push({ code: 'AVAILABILITY_WINDOW', message: `User is marked unavailable (Exception/PTO) on ${shiftDateStr}` });
      } else {
        const parseTimeStr = (t: string) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        if (exceptionForDay.startTime && exceptionForDay.endTime) {
            const availStartMin = parseTimeStr(exceptionForDay.startTime);
            const availEndMin = parseTimeStr(exceptionForDay.endTime);
            if (!(shiftStartMin >= availStartMin && shiftEndMin <= availEndMin)) {
              violations.push({ code: 'AVAILABILITY_WINDOW', message: `Availability exception window does not cover shift on ${shiftDateStr}` });
            }
        }
      }
    } else {
      const dbDayOfWeek = sStart.weekday === 7 ? 0 : sStart.weekday;
      const recurringForDay = userRecurringAvail.find(a => a.dayOfWeek === dbDayOfWeek);

      if (!recurringForDay) {
        violations.push({ code: 'AVAILABILITY_WINDOW', message: `User has no recurring availability on day ${dbDayOfWeek}` });
      } else {
        const parseTimeStr = (t: string) => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        const availStartMin = parseTimeStr(recurringForDay.startTime);
        const availEndMin = parseTimeStr(recurringForDay.endTime);
        
        if (!(shiftStartMin >= availStartMin && shiftEndMin <= availEndMin)) {
          violations.push({ code: 'AVAILABILITY_WINDOW', message: `Recurring availability window does not cover shift on day ${dbDayOfWeek}` });
        }
      }
    }

    // ==========================================
    // C4: Overlapping Shifts
    // ==========================================
    for (const a of userAssignments) {
      const aStart = DateTime.fromJSDate(a.shift.startUtc);
      const aEnd = DateTime.fromJSDate(a.shift.endUtc);
      if (DateTime.max(sStart, aStart) < DateTime.min(sEnd, aEnd)) {
        violations.push({ 
          code: 'DOUBLE_BOOKING', 
          message: 'User already has an overlapping shift',
          data: { location: a.shift.location.name, start: a.shift.startUtc, end: a.shift.endUtc }
        });
      }
    }

    // ==========================================
    // C5: Rest Period (10+ hours between shifts)
    // ==========================================
    let minGap = Infinity;
    for (const a of userAssignments) {
        const aStart = DateTime.fromJSDate(a.shift.startUtc);
        const aEnd = DateTime.fromJSDate(a.shift.endUtc);
        
        let gap = Infinity;
        if (sStart >= aEnd) gap = sStart.diff(aEnd, 'hours').hours;
        if (sEnd <= aStart) gap = aStart.diff(sEnd, 'hours').hours;
        
        if (gap < 10 && gap >= 0) {
            minGap = Math.min(minGap, gap);
        }
    }
    if (minGap < 10) {
        violations.push({ code: 'REST_GAP_VIOLATION', message: `Only ${Math.round(minGap * 10) / 10}h rest gap found, minimum required is 10h.` });
    }

    // ==========================================
    // C6: Daily Hours
    // ==========================================
    let sameDayHours = 0;
    for (const a of userAssignments) {
      const asStartLoc = DateTime.fromJSDate(a.shift.startUtc).setZone(shiftTz);
      if (asStartLoc.hasSame(sStart, 'day')) {
         const aEndLoc = DateTime.fromJSDate(a.shift.endUtc).setZone(shiftTz);
         sameDayHours += aEndLoc.diff(asStartLoc, 'hours').hours;
      }
    }
    const proposedShiftHours = sEnd.diff(sStart, 'hours').hours;
    const totalDaily = sameDayHours + proposedShiftHours;

    if (totalDaily > 12) {
      violations.push({ code: 'DAILY_HOURS_EXCEEDED', message: `Total daily hours would be ${totalDaily}, maximum allowed is 12.` });
    } else if (totalDaily > 8) {
      warnings.push({ code: 'DAILY_HOURS_WARNING', message: `Total daily hours will be ${totalDaily}, pushing over 8h.` });
    }

    // ==========================================
    // C7: Weekly Hours Limit (+8 OT buffer)
    // ==========================================
    const propShiftUtcDate = DateTime.fromJSDate(targetShiftRow.startUtc);
    const weekStartUtc = propShiftUtcDate.startOf('week');
    const weekEndUtc = propShiftUtcDate.endOf('week');

    let weekAssignedHours = 0;
    for (const a of userAssignments) {
        const aStart = DateTime.fromJSDate(a.shift.startUtc);
        const aEnd = DateTime.fromJSDate(a.shift.endUtc);
        if (aStart >= weekStartUtc && aStart <= weekEndUtc) {
            weekAssignedHours += aEnd.diff(aStart, 'hours').hours;
        }
    }

    const baseDesired = userRow.desiredHoursPerWeek ? Number(userRow.desiredHoursPerWeek) : null;
    if (baseDesired !== null) {
        const maxAllowed = baseDesired + 8;
        if (weekAssignedHours + proposedShiftHours > maxAllowed) {
            violations.push({ code: 'WEEKLY_HOURS_EXCEEDED', message: `Exceeds weekly hours limit (${maxAllowed}h allowed, currently ${weekAssignedHours}h, proposed ${proposedShiftHours}h)` });
        }
    }

    // ==========================================
    // C8: Consecutive Days Limit
    // ==========================================
    const workedDaysSet = new Set<string>();
    for (const a of userAssignments) {
        const asLoc = DateTime.fromJSDate(a.shift.startUtc).setZone(shiftTz);
        workedDaysSet.add(asLoc.toFormat('yyyy-MM-dd'));
    }
    workedDaysSet.add(shiftDateStr);

    let maxConsecutive = 0;
    for (let offset = -6; offset <= 0; offset++) {
        let consecutive = 0;
        let p = sStart.plus({ days: offset });
        while (workedDaysSet.has(p.toFormat('yyyy-MM-dd'))) {
            consecutive++;
            p = p.plus({ days: 1 });
        }
        if (consecutive > maxConsecutive) {
            maxConsecutive = consecutive;
        }
    }

    if (maxConsecutive >= 7) {
        violations.push({ code: 'SEVENTH_CONSECUTIVE_DAY', message: `Assigning this shift results in 7 consecutive days. Last day off was too far back.` });
    } else if (maxConsecutive === 6) {
        warnings.push({ code: 'SIXTH_CONSECUTIVE_DAY', message: `Assigning this shift results in 6 consecutive days.` });
    }

    // Generate suggestions if skill mismatch or location block
    let suggestions: any[] = [];
    if (violations.some(v => v.code === 'SKILL_MISMATCH' || v.code === 'LOCATION_NOT_CERTIFIED')) {
        const matchingUsers = await db.select({
            id: users.id, name: users.name
        })
        .from(users)
        .innerJoin(userSkills, eq(userSkills.userId, users.id))
        .innerJoin(userLocations, eq(userLocations.userId, users.id))
        .where(and(
            eq(users.isActive, true),
            eq(userSkills.skillId, targetShiftRow.skillId),
            eq(userLocations.locationId, targetShiftRow.locationId),
            eq(userLocations.isActive, true)
        ))
        .limit(5);
        suggestions = matchingUsers;
    }

    return {
      valid: violations.length === 0,
      violations,
      warnings,
      suggestions
    };
  }
}
