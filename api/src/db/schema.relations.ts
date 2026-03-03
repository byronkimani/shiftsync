import { relations } from 'drizzle-orm';
import {
  locations,
  users,
  userLocations,
  skills,
  userSkills,
  availability,
  availabilityExceptions,
  shifts,
  shiftAssignments,
  swapRequests,
  auditLogs,
  notifications
} from './schema';

export const locationsRelations = relations(locations, ({ many }) => ({
  shifts: many(shifts),
  userLocations: many(userLocations),
  availabilities: many(availability),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userLocations: many(userLocations),
  userSkills: many(userSkills),
  availabilities: many(availability),
  availabilityExceptions: many(availabilityExceptions),
  createdShifts: many(shifts, { relationName: 'createdShifts' }),
  shiftAssignments: many(shiftAssignments, { relationName: 'userAssignments' }),
  assignedShifts: many(shiftAssignments, { relationName: 'assignedBy' }),
  requestedSwaps: many(swapRequests, { relationName: 'requestedSwaps' }),
  targetedSwaps: many(swapRequests, { relationName: 'targetedSwaps' }),
  managedSwaps: many(swapRequests, { relationName: 'managedSwaps' }),
  auditLogs: many(auditLogs),
  notifications: many(notifications),
}));

export const userLocationsRelations = relations(userLocations, ({ one }) => ({
  user: one(users, {
    fields: [userLocations.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [userLocations.locationId],
    references: [locations.id],
  }),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  userSkills: many(userSkills),
  shifts: many(shifts),
}));

export const userSkillsRelations = relations(userSkills, ({ one }) => ({
  user: one(users, {
    fields: [userSkills.userId],
    references: [users.id],
  }),
  skill: one(skills, {
    fields: [userSkills.skillId],
    references: [skills.id],
  }),
}));

export const availabilityRelations = relations(availability, ({ one }) => ({
  user: one(users, {
    fields: [availability.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [availability.locationId],
    references: [locations.id],
  }),
}));

export const availabilityExceptionsRelations = relations(availabilityExceptions, ({ one }) => ({
  user: one(users, {
    fields: [availabilityExceptions.userId],
    references: [users.id],
  }),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  location: one(locations, {
    fields: [shifts.locationId],
    references: [locations.id],
  }),
  skill: one(skills, {
    fields: [shifts.skillId],
    references: [skills.id],
  }),
  createdBy: one(users, {
    fields: [shifts.createdBy],
    references: [users.id],
    relationName: 'createdShifts',
  }),
  assignments: many(shiftAssignments),
}));

export const shiftAssignmentsRelations = relations(shiftAssignments, ({ one, many }) => ({
  shift: one(shifts, {
    fields: [shiftAssignments.shiftId],
    references: [shifts.id],
  }),
  user: one(users, {
    fields: [shiftAssignments.userId],
    references: [users.id],
    relationName: 'userAssignments',
  }),
  assignedBy: one(users, {
    fields: [shiftAssignments.assignedBy],
    references: [users.id],
    relationName: 'assignedBy',
  }),
  requesterSwaps: many(swapRequests, { relationName: 'requesterAssignments' }),
  targetSwaps: many(swapRequests, { relationName: 'targetAssignments' }),
}));

export const swapRequestsRelations = relations(swapRequests, ({ one }) => ({
  requesterAssignment: one(shiftAssignments, {
    fields: [swapRequests.requesterAssignmentId],
    references: [shiftAssignments.id],
    relationName: 'requesterAssignments',
  }),
  targetAssignment: one(shiftAssignments, {
    fields: [swapRequests.targetAssignmentId],
    references: [shiftAssignments.id],
    relationName: 'targetAssignments',
  }),
  requester: one(users, {
    fields: [swapRequests.requesterId],
    references: [users.id],
    relationName: 'requestedSwaps',
  }),
  target: one(users, {
    fields: [swapRequests.targetId],
    references: [users.id],
    relationName: 'targetedSwaps',
  }),
  manager: one(users, {
    fields: [swapRequests.managerId],
    references: [users.id],
    relationName: 'managedSwaps',
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
