# ShiftSync

ShiftSync is a comprehensive staff scheduling application built for managers and shift workers to manage, assign, swap, and track shifts fairly.

## Live Deployment
- **Web App (Vercel):** `https://shiftsync-web-psi.vercel.app/sign-in`
- **API Server (Railway):** `https://shiftsync-production.up.railway.app/`

## Architecture
- **Monorepo:** Organized into `/api` (Node.js/Express) and `/web` (React/Vite).
- **Database:** PostgreSQL managed via Drizzle ORM.
- **Authentication:** Clerk.
- **Communication:** Resend API for transactional emails.

## Test Credentials
The database has been seeded with test accounts. To "log in" as one of these roles, you must **Sign Up** on the application using the email address below. Our system will automatically link your new account to the pre-configured role and data.

**Important:** Use any password you like during sign-up.

**Admin:**
- Email: `admin+clerk_test@shiftsync.com`
- Role: Full system access (Audit logs, all locations).

**Managers:**
- Email: `manager.downtown+clerk_test@shiftsync.com` (Downtown Clinic)
- Email: `manager.northside+clerk_test@shiftsync.com` (Northside Hospital)
- Email: `manager.eastside+clerk_test@shiftsync.com` (Eastside Urgent Care)
- Email: `manager.brooklyn+clerk_test@shiftsync.com` (Brooklyn Gardens)
- Role: Can create/publish shifts and approve swaps for their location.

**Staff:**
- Email: `staff.rn+clerk_test@shiftsync.com` (Registered Nurse - Alex)
- Email: `staff.lpn+clerk_test@shiftsync.com` (Licensed Practical Nurse - Ben)
- Role: Can view shifts, set availability, and request swaps/drops.

**Verification Code:** For all these test emails, use the code **`424242`** to bypass the verification step.

## Initial Setup & Deployment

### 1. Railway (Backend & Database)
1. Create a **PostgreSQL** database service.
2. Create an empty **Service (API)** and link your GitHub repo (select the `/api` root directory if configuring monolithically, or use a root `Procfile` if deploying as a monorepo).
3. Set Environment Variables:
   - `PORT=3000`
   - `DATABASE_URL` (Reference the PostgreSQL service inner URL)
   - `CLERK_SECRET_KEY` & `CLERK_WEBHOOK_SECRET`
   - `RESEND_API_KEY` & `RESEND_FROM_EMAIL`
   - `NODE_ENV=production`
4. The deployment will automatically run `npm run build` and start via `npm run start -w api`.
5. Once deployed, run the seed script via Railway CLI or locally pointing to the Railway DB:
   ```bash
   DATABASE_URL="your-railway-url" cd api && npm run db:migrate && npm run db:seed
   ```

### 2. Vercel (Frontend)
1. Import the repository and select the `/web` directory as the Root Directory.
2. Framework preset: **Vite**.
3. Set Environment Variables:
   - `VITE_API_URL` (The public URL provided by your Railway API service)
   - `VITE_CLERK_PUBLISHABLE_KEY`
4. Deploy.

### 3. Clerk (Auth Integrations)
1. In the Clerk Dashboard, go to **Webhooks** and add an endpoint: `{YOUR_RAILWAY_URL}/api/webhooks/clerk`. Subscribe to `user.created` and `user.updated`.
2. Ensure `{YOUR_RAILWAY_URL}` and `{YOUR_VERCEL_URL}` are added to allowed CORS origins in your Clerk instance settings.

## Known Limitations
- The realtime polling approach is used over WebSockets for simplicity in the current MVP phase.
- Some specific edge cases around highly overlapping timezone exceptions are handled gracefully but not extensively battle-tested.
