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

## Tech Stack
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL, Drizzle ORM
- **Frontend:** React, Vite, Tailwind CSS, React Query, Zustand
- **Authentication:** Clerk
- **Communications:** Resend (Email)

## Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd shiftsync
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Copy the provided `.env.example` file to create a `.env` file at the root or within the respective `/api` and `/web` directories. Ensure your local PostgreSQL connection string, Resend, and Clerk keys are configured.

4. **Database Setup:**
   Run the migrations and seed data script:
   ```bash
   cd api
   npm run db:migrate
   npm run db:seed
   ```

5. **Start Development Servers (Concurrent):**
   ```bash
   # Terminal 1 - Backend
   cd api && npm run dev

   # Terminal 2 - Frontend
   cd web && npm run dev
   ```
   The API will be available at `http://localhost:3000` and the web app at `http://localhost:5173`.

## Technical Decisions & Challenges Resolved

1. **Robust Timezone Architecture:** Coordinating shifts across locations in varying timezones is notoriously difficult. To solve this, all dates and times are stored natively in UTC within the PostgreSQL database. The conversion to local "wall-clock" time strictly happens on the frontend client at render-time, using `date-fns-tz` relative to the `timezone` property (e.g. `America/Los_Angeles`) defined on each Location record. This categorically eliminates daylight savings drift and server timezone bugs.
2. **Application-Layer Constraint Engine:** Validating shift constraints (like preventing overlapping shifts, enforcing 10-hour rest gaps, and checking max daily hours) using SQL triggers is brittle and difficult to test. Instead, we implemented a dedicated `ConstraintEngine` in TypeScript. This service executes all complex business rules within a shared database transaction before committing assignments, enabling us to return rich, human-readable UI violations and staff suggestions.
3. **Stateless Real-Time Updates:** While WebSockets represent the gold standard for real-time collaboration, introducing Socket.io or Redis creates significant infrastructure complexity. We opted for a resilient short-polling strategy using React Query's `refetchInterval`. A lightweight `/api/poll/` endpoint checks aggregate timestamps and counts every 5 seconds, pulling down heavy payloads only when the schema version actually increments.
4. **Optimistic UI Mutations:** React Query's `onMutate` cache manipulation is heavily utilized across the frontend (such as when marking notifications read, or approving swaps). This allows the application to instantly reflect state changes for a snappy UX, while safely rolling back the interface if the backend request eventually fails.
5. **Immutable Audit Trails:** For compliance, the Audit Log system strictly utilizes append-only inserts. State changes are captured as JSONB `before_state` and `after_state` snapshots directly on the log, allowing the UI to render precise visual diffs of shift assignment histories without requiring complex temporal table joins.

## Assumptions Made (Intentional Ambiguities)

- **Overnight Shifts:** Validity of shift assignment times during midnight crossovers is simplified by checking the start time against the employee's availability window for that originating day.
- **Availability Precedence:** One-off availability exceptions take absolute precedence over recurring weekly availability windows on any overlapping date.
- **Hard Constraints:** The system implements hard blocks forbidding a user from being assigned to work more than 12 hours in a single calendar day, or working a 7th consecutive day.
- **Timezone Abstraction:** Time metrics are stored natively in UTC and are formatted strictly on the client frontend relative to the `timezone` property of the `location` record to prevent daylight savings drift.
- **Soft Deletion:** Certification removal sets an `is_active = FALSE` flag instead of wiping records, ensuring historical data integrity.

## Known Limitations
- The realtime polling approach is used over WebSockets for simplicity in the current MVP phase.
- Some specific edge cases around highly overlapping timezone exceptions are handled gracefully but not extensively battle-tested.
