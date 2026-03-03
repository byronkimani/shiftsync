import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import path from 'path';
import { DateTime } from 'luxon';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool, { schema });

async function seed() {
  console.log('Seeding database...');
  
  // Clear tables (Cascade handled by FKs, but we truncate to be completely clean)
  await db.execute(`
    TRUNCATE TABLE 
      notifications, audit_logs, swap_requests, shift_assignments, shifts, 
      availability_exceptions, availability, user_skills, skills, 
      user_locations, users, locations 
    RESTART IDENTITY CASCADE;
  `);

  const now = DateTime.now().toUTC();
  const currentWeekStart = now.startOf('week'); // Monday
  const pastWeekStart = currentWeekStart.minus({ weeks: 1 });
  const futureWeekStart = currentWeekStart.plus({ weeks: 1 });

  // 1. Locations
  console.log('Inserting locations...');
  const locMarina = (await db.insert(schema.locations).values({
    name: "Coastal Eats Marina", address: "123 Marina Blvd, SF, CA", timezone: "America/Los_Angeles", editCutoffHours: 48
  }).returning())[0];
  const locWestside = (await db.insert(schema.locations).values({
    name: "Coastal Eats Westside", address: "456 Westside Ave, LA, CA", timezone: "America/Los_Angeles", editCutoffHours: 48
  }).returning())[0];
  const locMidtown = (await db.insert(schema.locations).values({
    name: "Coastal Eats Midtown", address: "789 Midtown St, NY, NY", timezone: "America/New_York", editCutoffHours: 48
  }).returning())[0];
  const locBrooklyn = (await db.insert(schema.locations).values({
    name: "Coastal Eats Brooklyn", address: "101 Brooklyn Ln, NY, NY", timezone: "America/New_York", editCutoffHours: 48
  }).returning())[0];

  // 2. Skills
  console.log('Inserting skills...');
  const skillBartender = (await db.insert(schema.skills).values({ name: "bartender" }).returning())[0];
  const skillLineCook = (await db.insert(schema.skills).values({ name: "line_cook" }).returning())[0];
  const skillServer = (await db.insert(schema.skills).values({ name: "server" }).returning())[0];
  const skillHost = (await db.insert(schema.skills).values({ name: "host" }).returning())[0];
  
  // 3. Users (1 Admin, 4 Managers, 12 Staff)
  console.log('Inserting users...');
  const admin = (await db.insert(schema.users).values({
    clerkId: "seed_admin", name: "Alice Admin", email: "admin+clerk_test@shiftsync.com", role: "admin"
  }).returning())[0];
  
  const managers = await db.insert(schema.users).values([
    { clerkId: "seed_manager_1", name: "Manager Marina", email: "manager.downtown+clerk_test@shiftsync.com", role: "manager" },
    { clerkId: "seed_manager_2", name: "Manager Westside", email: "manager.northside+clerk_test@shiftsync.com", role: "manager" },
    { clerkId: "seed_manager_3", name: "Manager Midtown", email: "manager.eastside+clerk_test@shiftsync.com", role: "manager" },
    { clerkId: "seed_manager_4", name: "Manager Brooklyn", email: "manager.brooklyn+clerk_test@shiftsync.com", role: "manager" }
  ]).returning();

  // Special staff members for edge cases
  const staff = await db.insert(schema.users).values([
    { clerkId: "seed_staff_1", name: "Alex (RN)", email: "staff.rn+clerk_test@shiftsync.com", role: "staff", desiredHoursPerWeek: "30.0" },
    { clerkId: "seed_staff_2", name: "Ben (LPN)", email: "staff.lpn+clerk_test@shiftsync.com", role: "staff", desiredHoursPerWeek: "35.0" },
    { clerkId: "seed_staff_3", name: "Chloe", email: "staff3+clerk_test@example.com", role: "staff", desiredHoursPerWeek: "20.0" },
    { clerkId: "seed_staff_4", name: "Dave", email: "staff4@example.com", role: "staff" },
    { clerkId: "seed_staff_5", name: "Eve", email: "staff5@example.com", role: "staff" },
    { clerkId: "seed_staff_6", name: "Frank", email: "staff6@example.com", role: "staff" },
    { clerkId: "seed_staff_7", name: "Grace", email: "staff7@example.com", role: "staff" },
    { clerkId: "seed_staff_8", name: "Hank", email: "staff8@example.com", role: "staff" },
    { clerkId: "seed_staff_9", name: "Ivy", email: "staff9@example.com", role: "staff" },
    { clerkId: "seed_staff_10", name: "Jack", email: "staff10@example.com", role: "staff" },
    { clerkId: "seed_staff_11", name: "Karen", email: "staff11@example.com", role: "staff" },
    { clerkId: "seed_staff_12", name: "Leo", email: "staff12@example.com", role: "staff" },
  ]).returning();

  [admin, ...managers, ...staff].forEach((u, i) => {
    // just dummy
  });

  // Assign user_locations
  await db.insert(schema.userLocations).values([
    { userId: managers[0].id, locationId: locMarina.id, roleContext: "manager" },
    { userId: managers[1].id, locationId: locWestside.id, roleContext: "manager" },
    { userId: managers[2].id, locationId: locMidtown.id, roleContext: "manager" },
    { userId: managers[3].id, locationId: locBrooklyn.id, roleContext: "manager" },
    
    // Certify staff
    { userId: staff[0].id, locationId: locMarina.id, roleContext: "staff" },
    { userId: staff[1].id, locationId: locMarina.id, roleContext: "staff" },
    { userId: staff[2].id, locationId: locMarina.id, roleContext: "staff" },
    { userId: staff[3].id, locationId: locMarina.id, roleContext: "staff" },
    { userId: staff[4].id, locationId: locMarina.id, roleContext: "staff" },
    { userId: staff[5].id, locationId: locMidtown.id, roleContext: "staff" },
    
    // Multi timezone staff (Grace)
    { userId: staff[6].id, locationId: locMarina.id, roleContext: "staff" },
    { userId: staff[6].id, locationId: locMidtown.id, roleContext: "staff" },
    
    { userId: staff[7].id, locationId: locBrooklyn.id, roleContext: "staff" },
    { userId: staff[8].id, locationId: locWestside.id, roleContext: "staff" },
    { userId: staff[9].id, locationId: locWestside.id, roleContext: "staff" },
    { userId: staff[10].id, locationId: locMidtown.id, roleContext: "staff" },
    { userId: staff[11].id, locationId: locBrooklyn.id, roleContext: "staff" },
  ]);

  // Assign skills
  await db.insert(schema.userSkills).values([
    { userId: staff[0].id, skillId: skillBartender.id },
    { userId: staff[1].id, skillId: skillServer.id },
    { userId: staff[2].id, skillId: skillHost.id },
    { userId: staff[3].id, skillId: skillBartender.id },
    { userId: staff[3].id, skillId: skillHost.id },   // Dave: bartender + host (needed for premium host shifts)
    { userId: staff[4].id, skillId: skillBartender.id },
    { userId: staff[5].id, skillId: skillLineCook.id },
    { userId: staff[6].id, skillId: skillServer.id },
    { userId: staff[7].id, skillId: skillBartender.id },
    { userId: staff[8].id, skillId: skillHost.id },
    { userId: staff[9].id, skillId: skillServer.id },
    { userId: staff[10].id, skillId: skillLineCook.id },
    { userId: staff[11].id, skillId: skillBartender.id },
  ]);

  // Availability setup (realistic)
  // Grace (multi-tz):
  //   - Midtown (ET): Mon-Fri 09:00-17:00 ET
  //   - Marina (PT):  Mon-Fri 09:00-17:00 PT  <-- Issue 6 fix: enables timezone tangle scenario
  //     Marina shift at 4pm PT (23:00 UTC) → PASS
  //     Marina shift at 6pm PT (02:00 UTC+1) → FAIL AVAILABILITY_WINDOW
  await db.insert(schema.availability).values([
    // Midtown (ET)
    { userId: staff[6].id, locationId: locMidtown.id, dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
    { userId: staff[6].id, locationId: locMidtown.id, dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
    { userId: staff[6].id, locationId: locMidtown.id, dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
    { userId: staff[6].id, locationId: locMidtown.id, dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
    { userId: staff[6].id, locationId: locMidtown.id, dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
    // Marina (PT)
    { userId: staff[6].id, locationId: locMarina.id, dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
    { userId: staff[6].id, locationId: locMarina.id, dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
    { userId: staff[6].id, locationId: locMarina.id, dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
    { userId: staff[6].id, locationId: locMarina.id, dayOfWeek: 4, startTime: '09:00', endTime: '17:00' },
    { userId: staff[6].id, locationId: locMarina.id, dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
  ]);

  // Create standard shifts + assignments
  console.log('Inserting shifts...');
  
  type ShiftInsert = typeof schema.shifts.$inferInsert;
  const shiftsToInsert: ShiftInsert[] = [];

  // Edge case 1: Alex (staff[0]) at 38h overtime approaching
  // We need to schedule him for 38 total hours this week.
  // We'll give him four 8-hour shifts + one 6-hour shift
  for (let i = 0; i < 5; i++) {
    const shiftStart = currentWeekStart.plus({ days: i, hours: 10 }).toJSDate(); // 10:00 UTC
    const hours = (i === 4) ? 6 : 8;
    const shiftEnd = currentWeekStart.plus({ days: i, hours: 10 + hours }).toJSDate();
    
    shiftsToInsert.push({
      locationId: locMarina.id, skillId: skillBartender.id,
      startUtc: shiftStart, endUtc: shiftEnd,
      status: 'published', isPremium: false, createdBy: managers[0].id
    });
  }

  // Edge case 2: Ben (staff[1]) on 6 consecutive days this week
  for (let i = 0; i < 6; i++) {
    const dStart = currentWeekStart.plus({ days: i, hours: 12 }).toJSDate();
    const dEnd = currentWeekStart.plus({ days: i, hours: 18 }).toJSDate();
    shiftsToInsert.push({
      locationId: locMarina.id, skillId: skillServer.id,
      startUtc: dStart, endUtc: dEnd,
      status: 'published', isPremium: false, createdBy: managers[0].id
    });
  }

  // Edge case 3: Chloe (staff[2]) zero premium shifts past 3 weeks — fairness test
  // FIX (Issue 3): Premium shifts now use skillHost so Chloe IS in the eligible pool.
  // They are assigned to Dave (staff[3], also host-certified at Marina), NOT Chloe.
  // This means the fairness report will flag Chloe: 0 premium vs Dave: 3 premium.
  for (let weekOffset of [-1, 0, 1]) {
    const baseW = currentWeekStart.plus({ weeks: weekOffset });
    
    // Chloe gets a normal mid-week host shift (not premium)
    shiftsToInsert.push({
      locationId: locMarina.id, skillId: skillHost.id,
      startUtc: baseW.plus({ days: 2, hours: 12 }).toJSDate(), // Wed noon
      endUtc: baseW.plus({ days: 2, hours: 20 }).toJSDate(),
      status: 'published', isPremium: false, createdBy: managers[0].id,
      notes: "Chloe's normal host shift"
    });

    // Premium host shift on Friday assigned to Dave — puts Chloe in eligible pool with 0
    shiftsToInsert.push({
      locationId: locMarina.id, skillId: skillHost.id, // host skill — Chloe IS eligible
      startUtc: baseW.plus({ days: 4, hours: 18 }).toJSDate(), // Fri night
      endUtc: baseW.plus({ days: 4, hours: 23 }).toJSDate(),
      status: 'published', isPremium: true, createdBy: managers[0].id,
      notes: "Premium host shift (Dave assigned, NOT Chloe — fairness test)"
    });
  }

  // Edge case 4/5: Pending Swap Request / Expired Drop Request
  // We need two shifts for Dave and Eve (Swap) and one for Frank (Drop)
  const swapShift1: ShiftInsert = {
    locationId: locMarina.id, skillId: skillBartender.id,
    startUtc: futureWeekStart.plus({ days: 1, hours: 10 }).toJSDate(),
    endUtc: futureWeekStart.plus({ days: 1, hours: 18 }).toJSDate(),
    status: 'published', isPremium: false, createdBy: managers[0].id
  };
  const swapShift2: ShiftInsert = {
    locationId: locMarina.id, skillId: skillBartender.id,
    startUtc: futureWeekStart.plus({ days: 2, hours: 10 }).toJSDate(),
    endUtc: futureWeekStart.plus({ days: 2, hours: 18 }).toJSDate(),
    status: 'published', isPremium: false, createdBy: managers[0].id
  };
  
  // A dropped shift that started in the past (so it's expired)
  const dropShift: ShiftInsert = {
    locationId: locMidtown.id, skillId: skillLineCook.id,
    startUtc: pastWeekStart.plus({ days: 1, hours: 10 }).toJSDate(),
    endUtc: pastWeekStart.plus({ days: 1, hours: 18 }).toJSDate(),
    status: 'published', isPremium: false, createdBy: managers[2].id
  };

  // Edge Case 6: Shift within 48h of now (cutoff checking)
  const nearShiftStart = now.plus({ hours: 24 }).toJSDate();
  const nearShiftEnd = now.plus({ hours: 32 }).toJSDate();
  shiftsToInsert.push({
    locationId: locMarina.id, skillId: skillBartender.id,
    startUtc: nearShiftStart, endUtc: nearShiftEnd,
    status: 'published', isPremium: false, createdBy: managers[0].id,
    notes: 'Near 48h cutoff'
  });

  // Bulk Insert all standard edge case shifts
  const insertedShifts = await db.insert(schema.shifts).values(shiftsToInsert).returning();

  // Insert the swap/drop specific shifts separate so we can grab IDs easily
  const [s1, s2, sDrop] = await db.insert(schema.shifts).values([swapShift1, swapShift2, dropShift]).returning();
  
  console.log('Inserting assignments...');
  // Assign Alex (0..4)
  for (let i = 0; i < 5; i++) {
    await db.insert(schema.shiftAssignments).values({
      shiftId: insertedShifts[i].id, userId: staff[0].id, assignedBy: managers[0].id
    });
  }
  // Assign Ben (5..10)
  for (let i = 5; i < 11; i++) {
    await db.insert(schema.shiftAssignments).values({
      shiftId: insertedShifts[i].id, userId: staff[1].id, assignedBy: managers[0].id
    });
  }
  
  // Assign Chloe & Dave (11..16)
  // insertedShifts[11,13,15] = Chloe's normal host shifts (i % 2 === 1)
  // insertedShifts[12,14,16] = Premium host shifts (i % 2 === 0) → assigned to Dave
  // Chloe is NOT assigned any premium shift → fairness report flags her (Issue 3)
  for (let i = 11; i < 17; i++) {
    if (i % 2 === 1) { // Chloe's normal shifts
      await db.insert(schema.shiftAssignments).values({
        shiftId: insertedShifts[i].id, userId: staff[2].id, assignedBy: managers[0].id
      });
    } else { // Premium host shifts → Dave (staff[3], host-certified at Marina)
      await db.insert(schema.shiftAssignments).values({
        shiftId: insertedShifts[i].id, userId: staff[3].id, assignedBy: managers[0].id
      });
    }
  }

  // Assign near cutoff to Alex
  await db.insert(schema.shiftAssignments).values({
    shiftId: insertedShifts[17].id, userId: staff[0].id, assignedBy: managers[0].id
  });

  // Assign Swaps & Drop
  const assignSwap1 = (await db.insert(schema.shiftAssignments).values({
    shiftId: s1.id, userId: staff[3].id, assignedBy: managers[0].id
  }).returning())[0];
  
  const assignSwap2 = (await db.insert(schema.shiftAssignments).values({
    shiftId: s2.id, userId: staff[4].id, assignedBy: managers[0].id
  }).returning())[0];

  const assignDrop = (await db.insert(schema.shiftAssignments).values({
    shiftId: sDrop.id, userId: staff[5].id, assignedBy: managers[2].id
  }).returning())[0];

  console.log('Inserting Swap Requests...');
  // 1 pending swap
  await db.insert(schema.swapRequests).values({
    type: 'swap', status: 'pending',
    requesterAssignmentId: assignSwap1.id, requesterId: staff[3].id,
    targetAssignmentId: assignSwap2.id, targetId: staff[4].id
  });

  // 1 expired drop
  await db.insert(schema.swapRequests).values({
    type: 'drop', status: 'expired',
    requesterAssignmentId: assignDrop.id, requesterId: staff[5].id,
    resolvedAt: now.minus({ days: 1 }).toJSDate()
  });

  // Bulk fill random shifts to get > 40 total
  const randomShifts: ShiftInsert[] = [];
  for (let i=0; i < 25; i++) {
    const rStart = currentWeekStart.plus({ days: (i % 7), hours: 8 + (i % 5) }).toJSDate();
    const rEnd = currentWeekStart.plus({ days: (i % 7), hours: 8 + (i % 5) + 6 }).toJSDate();
    
    randomShifts.push({
      locationId: locBrooklyn.id, skillId: skillBartender.id,
      startUtc: rStart, endUtc: rEnd, status: 'published', isPremium: (i % 5 === 0),
      createdBy: managers[3].id
    });
  }
  const insRandom = await db.insert(schema.shifts).values(randomShifts).returning();
  
  // Assign those
  for(let i=0; i<insRandom.length; i++) {
    await db.insert(schema.shiftAssignments).values({
      shiftId: insRandom[i].id, userId: staff[11].id, assignedBy: managers[3].id
    });
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
