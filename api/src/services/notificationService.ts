import { db } from '../db';
import { notifications, users } from '../db/schema';
import { Resend } from 'resend';
import { eq } from 'drizzle-orm';

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_TEMPLATES: Record<string, string> = {
  shift_published: "A Shift Has Been Published",
  schedule_published: "New Schedule Published",
  shift_assigned: "You Have a New Shift Assignment",
  shift_updated: "Shift Details Automatically Updated",
  shift_cancelled: "Shift Cancelled",
  shift_dropped: "You Were Dropped From a Shift",
  swap_request_received: "New Shift Swap Request",
  swap_accepted: "Swap Request Accepted By Peer",
  swap_cancelled: "Swap Request Cancelled",
  swap_withdrawn: "Swap Request Withdrawn",
  swap_rejected_manager: "Swap Request Rejected by Manager",
  swap_approved: "Swap Request Approved!",
  audit_export_ready: "Your Audit Log Export is Ready"
};

export class NotificationService {
  static async notify(userId: string, type: string, summary: string, payload: any = {}) {
    try {
      // 1. Fetch user to check preferences
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      if (!user) return;

      // 2. In-App Notification
      if (user.notificationInApp) {
        await db.insert(notifications).values({
          userId,
          type,
          payload: { summary, ...payload },
          createdAt: new Date()
        });
      }

      // 3. Email Notification
      if (user.notificationEmail && process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('re_dummy')) {
        if (!user.email.endsWith('@example.com')) {
           const subjectTemplate = EMAIL_TEMPLATES[type] || `ShiftSync: ${summary}`;
           await resend.emails.send({
             from: process.env.RESEND_FROM_EMAIL || 'notifications@shiftsync.app',
             to: user.email,
             subject: `ShiftSync: ${subjectTemplate}`,
             html: `<p>Hello ${user.name},</p><p>${summary}</p><p>Log in to ShiftSync to view details.</p>`
           });
        }
      }

    } catch (error) {
      console.error(`NotificationService error sending ${type}:`, error);
    }
  }
}
