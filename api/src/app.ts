import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import { webhookRouter } from './routes/webhooks';
import { meRouter } from './routes/me';
import { locationsRouter } from './routes/locations';
import { skillsRouter } from './routes/skills';
import { usersRouter } from './routes/users';
import { availabilityRouter } from './routes/availability';
import { engineRouter } from './routes/engine';
import { shiftsRouter } from './routes/shifts';
import { assignmentsRouter } from './routes/assignments';
import { swapsRouter } from './routes/swaps';
import { notificationsRouter } from './routes/notifications';
import { analyticsRouter } from './routes/analytics';
import { auditRouter } from './routes/audit';
import { pollRouter } from './routes/poll';
import { ondutyRouter } from './routes/onduty';

export function createApp() {
  const app = express();

  app.use(cors());
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Webhooks must be registered before express.json() because they require raw body parsing
  app.use('/webhooks', webhookRouter);

  app.use(express.json());
  
  // Clerk middleware globally before routes
  app.use(clerkMiddleware());

  app.use('/api', meRouter);
  app.use('/api', locationsRouter);
  app.use('/api', skillsRouter);
  app.use('/api', usersRouter);
  app.use('/api/users/:userId', availabilityRouter);
  app.use('/api', engineRouter);
  app.use('/api', shiftsRouter);
  app.use('/api/shifts/:shiftId/assignments', assignmentsRouter);
  app.use('/api', swapsRouter);
  app.use('/api', notificationsRouter);
  app.use('/api', analyticsRouter);
  app.use('/api', auditRouter);
  app.use('/api', pollRouter);
  app.use('/api', ondutyRouter);

  return app;
}
