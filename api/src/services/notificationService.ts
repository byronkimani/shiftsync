import { db } from '../db';
import { notifications, users } from '../db/schema';
import { Resend } from 'resend';
import { eq } from 'drizzle-orm';

const resend = new Resend(process.env.RESEND_API_KEY);

export class NotificationService {
  /**
   * Sends an in-app notification and/or email based on user preferences.
   * 
   * @param userId The ID of the user to notify
   * @param type The type/category of the notification (e.g. 'shift_published', 'swap_request_approved')
   * @param summary A short, readable summary for the in-app bell
   * @param payload Optional JSON data for the frontend to build links/context
   */
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
      // We skip sending actual emails to dummy clerk addresses or if Resend isn't configured 
      // with a verified domain to prevent bounces, but the logic handles it cleanly.
      if (user.notificationEmail && process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('re_dummy')) {
        // Skip dummy seeded emails
        if (!user.email.endsWith('@example.com')) {
           await resend.emails.send({
             from: process.env.RESEND_FROM_EMAIL || 'notifications@shiftsync.app',
             to: user.email,
             subject: `ShiftSync: ${summary}`,
             html: `<p>Hello ${user.name},</p><p>${summary}</p><p>Log in to ShiftSync to view details.</p>`
           });
        }
      }

    } catch (error) {
      console.error('NotificationService error:', error);
      // We don't want a notification failure to crash the main transaction/route
    }
  }
}
