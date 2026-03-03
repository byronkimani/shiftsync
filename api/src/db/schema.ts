import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
  time,
  jsonb,
  pgEnum,
  primaryKey,
  check,
  index,
  unique
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enums
export const roleEnum = pgEnum('role', ['admin', 'manager', 'staff']);
export const roleContextEnum = pgEnum('role_context', ['manager', 'staff']);
export const shiftStatusEnum = pgEnum('shift_status', ['draft', 'published', 'cancelled']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['assigned', 'dropped', 'swapped']);
export const swapTypeEnum = pgEnum('swap_type', ['swap', 'drop']);
export const swapStatusEnum = pgEnum('swap_status', ['pending', 'accepted', 'approved', 'cancelled', 'expired']);

// Utility for default uuid
const defaultUUID = () => sql`gen_random_uuid()`;
const defaultNow = () => sql`NOW()`;

// ============================================================
// LOCATIONS
// ============================================================
export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().default(defaultUUID()),
  name: text('name').notNull(),
  address: text('address').notNull(),
  timezone: text('timezone').notNull(),
  editCutoffHours: integer('edit_cutoff_hours').notNull().default(48),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(defaultNow()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(defaultNow())
});

// ============================================================
// USERS
// ============================================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(defaultUUID()),
  clerkId: text('clerk_id').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: roleEnum('role').notNull(),
  desiredHoursPerWeek: numeric('desired_hours_per_week', { precision: 4, scale: 1 }),
  notificationInApp: boolean('notification_in_app').notNull().default(true),
  notificationEmail: boolean('notification_email').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(defaultNow()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(defaultNow())
}, (table) => ({
  clerkIdIdx: index('idx_users_clerk_id').on(table.clerkId),
  roleIdx: index('idx_users_role').on(table.role)
}));


// ============================================================
// USER_LOCATIONS
// ============================================================
export const userLocations = pgTable('user_locations', {
  id: uuid('id').primaryKey().default(defaultUUID()),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  roleContext: roleContextEnum('role_context').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  certifiedAt: timestamp('certified_at', { withTimezone: true }).notNull().default(defaultNow()),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(defaultNow()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(defaultNow())
}, (table) => ({
  unq: unique().on(table.userId, table.locationId, table.roleContext),
  userIdIdx: index('idx_user_locations_user_id').on(table.userId),
  locationIdIdx: index('idx_user_locations_location_id').on(table.locationId)
}));

// ============================================================
// SKILLS
// ============================================================
export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().default(defaultUUID()),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(defaultNow())
});

// ============================================================
// USER_SKILLS
// ============================================================
export const userSkills = pgTable('user_skills', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  skillId: uuid('skill_id').notNull().references(() => skills.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(defaultNow())
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.skillId] }),
  skillIdIdx: index('idx_user_skills_skill_id').on(table.skillId)
}));

// ============================================================
// AVAILABILITY
// ============================================================
export const availability = pgTable('availability', {
  id: uuid('id').primaryKey().default(defaultUUID()),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  effectiveFrom: date('effective_from').notNull().default(sql`CURRENT_DATE`),
  effectiveUntil: date('effective_until'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(defaultNow()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(defaultNow())
}, (table) => ({
  dayCheck: check('availability_day_check', sql`${table.dayOfWeek} BETWEEN 0 AND 6`),
  timeCheck: check('availability_times_valid', sql`${table.endTime} > ${table.startTime}`),
  userLocationIdx: index('idx_availability_user_location').on(table.userId, table.locationId),
  dayIdx: index('idx_availability_day').on(table.dayOfWeek)
}));

// ============================================================
// AVAILABILITY_EXCEPTIONS
// ============================================================
export const availabilityExceptions = pgTable('availability_exceptions', {
  id: uuid('id').primaryKey().default(defaultUUID()),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  available: boolean('available').notNull(),
  startTime: time('start_time'),
  endTime: time('end_time'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(defaultNow()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(defaultNow())
}, (table) => ({
  unq: unique().on(table.userId, table.date),
  timeCheck: check(
    'exception_times_valid',
    sql`(${table.available} = FALSE AND ${table.startTime} IS NULL AND ${table.endTime} IS NULL) OR (${table.available} = TRUE AND ${table.startTime} IS NOT NULL AND ${table.endTime} IS NOT NULL AND ${table.endTime} > ${table.startTime})`
  ),
  userDateIdx: index('idx_availability_exceptions_user_date').on(table.userId, table.date)
}));

// ============================================================
// SHIFTS
// ============================================================
export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().default(defaultUUID()),
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'restrict' }),
  skillId: uuid('skill_id').notNull().references(() => skills.id, { onDelete: 'restrict' }),
  startUtc: timestamp('start_utc', { withTimezone: true }).notNull(),
  endUtc: timestamp('end_utc', { withTimezone: true }).notNull(),
  headcountRequired: integer('headcount_required').notNull().default(1),
  status: shiftStatusEnum('status').notNull().default('draft'),
  isPremium: boolean('is_premium').notNull().default(false),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(defaultNow()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(defaultNow())
}, (table) => ({
  hcCheck: check('headcount_required_check', sql`${table.headcountRequired} > 0`),
  timeCheck: check('shift_times_valid', sql`${table.endUtc} > ${table.startUtc}`),
  locIdx: index('idx_shifts_location_id').on(table.locationId),
  skillIdx: index('idx_shifts_skill_id').on(table.skillId),
  startIdx: index('idx_shifts_start_utc').on(table.startUtc),
  statusIdx: index('idx_shifts_status').on(table.status),
  locWeekIdx: index('idx_shifts_location_week').on(table.locationId, table.startUtc)
}));

// ============================================================
// SHIFT_ASSIGNMENTS
// ============================================================
export const shiftAssignments = pgTable('shift_assignments', {
  id: uuid('id').primaryKey().default(defaultUUID()),
  shiftId: uuid('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  status: assignmentStatusEnum('status').notNull().default('assigned'),
  assignedBy: uuid('assigned_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().default(defaultNow()),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(defaultNow()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(defaultNow())
}, (table) => ({
  unq: unique().on(table.shiftId, table.userId),
  shiftIdx: index('idx_shift_assignments_shift_id').on(table.shiftId),
  userIdx: index('idx_shift_assignments_user_id').on(table.userId),
  userStatusIdx: index('idx_shift_assignments_user_status').on(table.userId, table.status)
}));

// ============================================================
// SWAP_REQUESTS
// ============================================================
export const swapRequests = pgTable('swap_requests', {
  id: uuid('id').primaryKey().default(defaultUUID()),
  type: swapTypeEnum('type').notNull(),
  requesterAssignmentId: uuid('requester_assignment_id').notNull().references(() => shiftAssignments.id, { onDelete: 'cascade' }),
  targetAssignmentId: uuid('target_assignment_id').references(() => shiftAssignments.id, { onDelete: 'set null' }),
  requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  targetId: uuid('target_id').references(() => users.id, { onDelete: 'restrict' }),
  managerId: uuid('manager_id').references(() => users.id, { onDelete: 'restrict' }),
  status: swapStatusEnum('status').notNull().default('pending'),
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(defaultNow()),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(defaultNow()),
  resolvedAt: timestamp('resolved_at', { withTimezone: true })
}, (table) => ({
  targetCheck: check(
    'swap_requires_target',
    sql`(${table.type} = 'swap' AND ${table.targetAssignmentId} IS NOT NULL AND ${table.targetId} IS NOT NULL) OR (${table.type} = 'drop' AND ${table.targetAssignmentId} IS NULL)`
  ),
  reqIdx: index('idx_swap_requests_requester_id').on(table.requesterId),
  targetIdx: index('idx_swap_requests_target_id').on(table.targetId),
  statusIdx: index('idx_swap_requests_status').on(table.status)
}));

// ============================================================
// AUDIT_LOGS
// ============================================================
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().default(defaultUUID()),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(),
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),
  actorId: uuid('actor_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  ipAddress: text('ip_address'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().default(defaultNow()),
  summary: text('summary') // From chunk 11 requirements
}, (table) => ({
  entityIdx: index('idx_audit_logs_entity').on(table.entityType, table.entityId),
  actorIdx: index('idx_audit_logs_actor_id').on(table.actorId),
  occurredIdx: index('idx_audit_logs_occurred_at').on(table.occurredAt),
  typeIdx: index('idx_audit_logs_entity_type').on(table.entityType)
}));

// ============================================================
// NOTIFICATIONS
// ============================================================
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().default(defaultUUID()),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(defaultNow())
}, (table) => ({
  userIdx: index('idx_notifications_user_id').on(table.userId),
  userReadIdx: index('idx_notifications_user_read').on(table.userId, table.read),
  createdIdx: index('idx_notifications_created_at').on(table.createdAt)
}));
