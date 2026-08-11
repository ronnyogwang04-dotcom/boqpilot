# BOQPilot

AI-powered BOQ pricing, benchmarking & tender assistant for construction contractors.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (Postgres + Auth), and PayFast.

## Tech stack

- **Framework:** Next.js 15 (App Router, React 19)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Database / Auth:** Supabase (PostgreSQL), multi-tenant via an `organisations` table (one per user for now — see Enterprise architecture below)
- **Payments:** PayFast (ZAR) behind a provider-agnostic Payment Service layer; pricing is computed by a strategy-pattern Pricing Engine before any payment begins
- **Linting:** ESLint (`eslint-config-next`)
- **Deployment:** Vercel

## Project structure

```
src/
  app/
    (auth)/login/             Login page
    (auth)/sign-up/           Register page
    (auth)/forgot-password/   Request a password reset email
    (auth)/reset-password/    Set a new password (requires a valid recovery link)
    (dashboard)/layout.tsx    Auth-guarded layout: fetches the user, renders the shell
    (dashboard)/dashboard/    Dashboard overview + Settings (profile, sign out)
    auth/callback/            Exchanges Supabase email-link codes for a session
    auth/auth-code-error/     Shown when a link is invalid/expired
    dashboard/projects/          Projects list (search/filter), New project, Project Dashboard, Edit
    dashboard/projects/[id]/boq/upload/        BOQ upload form, scoped to a project (Server Action)
    dashboard/projects/[id]/boq/[boqId]/       BOQ Processing Preview: file info, tier, price/FREE, Proceed to Payment
    dashboard/projects/[id]/boq/[boqId]/processing/  Processing Screen: progress bar, stage checklist
    dashboard/admin/             Admin Dashboard (role-gated platform-wide metrics)
    payments/success/           Landing page after a PayFast payment (return_url), BOQ-aware
    payments/cancelled/         Landing page when a buyer cancels at PayFast (cancel_url), BOQ-aware
    api/health/                 Health check endpoint
    api/boq/[id]/pay/            Starts payment for a priced BOQ (delegates to the Payment Service)
    api/payments/payfast/create/  Starts a payment for the subscription plan (delegates to the Payment Service)
    api/payments/payfast/itn/     PayFast's server-to-server payment notification (delegates to the Payment Service)
    layout.tsx, page.tsx        Root layout and landing page
    error.tsx, global-error.tsx, not-found.tsx  App-wide error/404 boundaries
  components/
    auth/                      Login/sign-up/forgot/reset forms (client, Server Actions)
    boq/                       BOQ upload form
    projects/                  Project create/edit form (shared by New and Edit pages)
    dashboard/                 Profile settings form, payment status badge
    shared/                    Customer trust notice
    layout/                    Navbar, footer, sidebar (role-aware), topbar, user menu
    ui/                        Button, Alert, Spinner, SubmitButton
  config/
    pricing.ts                  Page-count tiers, free trial cap, enterprise threshold — the file to edit to change pricing
    billing.ts                  Existing subscription plan (unrelated to BOQ pricing)
    site.ts, nav.ts              Site constants, dashboard nav items (nav items can be `adminOnly`)
  lib/
    actions/                   Server Actions: login, signup, password reset, sign out, profile update, BOQ upload, project create/update
    audit/                     log-event.ts — append-only audit log helper
    boq/                       pdf.ts — in-memory PDF page-count extraction (file is never persisted)
    processing/                status.ts — Processing Job stage order, friendly labels, progress percentage
    pricing/                   Pricing Engine: PricingStrategy interface, PricingEngine, PageCountPricingStrategy, free-trial eligibility
    payments/                  Payment Service layer: PaymentService (app-facing), PaymentProvider interface, PayFastPaymentProvider
    supabase/                  Browser, server, middleware, and service-role Supabase clients
    validations/                zod schemas for auth and project forms
    utils.ts, get-origin.ts, format.ts  Shared helpers
  types/                       Shared TypeScript types, incl. Supabase database types
  middleware.ts                Refreshes the Supabase session and guards /dashboard
supabase/
  migrations/                  SQL schema — see Enterprise architecture below for the full table list
```

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in your keys:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Description |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only — used to write payment status from the PayFast ITN handler, which has no user session) |
   | `PAYMENT_PROVIDER` | Which `PaymentProvider` the Payment Service uses (default `payfast`) — see `src/lib/payments/provider-factory.ts` |
   | `PAYFAST_MODE` | `sandbox` or `production` (default `sandbox`) |
   | `PAYFAST_MERCHANT_ID` | PayFast merchant ID. Optional in sandbox mode — falls back to PayFast's public test merchant (`10000100`) |
   | `PAYFAST_MERCHANT_KEY` | PayFast merchant key. Same sandbox fallback as above |
   | `PAYFAST_PASSPHRASE` | Optional passphrase configured in your PayFast merchant dashboard; strongly recommended, required for tighter signature security |
   | `NEXT_PUBLIC_SITE_URL` | Public URL of the app, used as a fallback when building PayFast return/cancel/notify URLs |

3. Apply the database schema in `supabase/migrations/` to your Supabase project, **in order** (or `supabase db push` if you use the Supabase CLI): `00000000000001_init.sql`, `00000000000002_payments.sql`, `00000000000003_boq_pricing.sql`, then `00000000000004_enterprise_architecture.sql`. The last migration is the big one — see **Enterprise architecture** below for what it creates. It also runs `create extension if not exists vector` for the future rate-engine table; this is supported on all Supabase projects, but flag it if it errors on yours.

   To use the Admin Dashboard, flip a user to staff after signing up — there's no invite UI yet:
   ```sql
   update public.profiles set role = 'admin' where id = '<your-user-id>';
   ```

4. In the Supabase dashboard, under **Authentication → URL Configuration**, set:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` (and your production `https://<your-domain>/auth/callback` once deployed)

   This is required for email confirmation and password reset links to redirect back into the app correctly.

5. Run the dev server:

   ```bash
   npm run dev
   ```

   The app is served at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run the TypeScript compiler in check-only mode |

## Testing authentication locally

With the dev server running at `http://localhost:3000`:

1. **Register** — go to `/sign-up`, fill in name/email/password (8+ characters). You'll see "We sent a confirmation link to...". Check the inbox for that email (Supabase's default email provider works out of the box for testing; rate-limited, so don't spam it).
2. **Confirm** — click the link in the email. It hits `/auth/callback`, exchanges the code for a session, and redirects to `/dashboard`.
3. **Logout** — open the profile menu (top-right avatar) → **Sign out**. You're redirected to `/`.
4. **Login** — go to `/login` and sign back in with the same credentials.
5. **Protected routes** — while logged out, visit `/dashboard` directly; you're redirected to `/login?next=/dashboard`. While logged in, visiting `/login` or `/sign-up` redirects you back to `/dashboard`.
6. **Forgot password** — go to `/forgot-password`, submit your email, then open the reset email and follow the link. It lands on `/reset-password` (rejecting the page with "Link expired or invalid" if visited without a valid link) where you can set a new password, then you're redirected to `/login?reset=success`.

Notes:
- If **Authentication → Email confirmation** is disabled in your Supabase project, sign-up logs the user in immediately instead of requiring a confirmation click.
- Without the `profiles` migration applied (see step 3 above), the dashboard still works but shows the account email instead of a full name, and Settings can't persist profile edits.
- To skip real emails during development, you can use [Inbucket/Mailpit via the Supabase CLI](https://supabase.com/docs/guides/local-development) (`supabase start`) instead of a hosted project, or a disposable inbox like Mailinator.

## Enterprise architecture

BOQPilot's data model is a hierarchy, not a flat "user uploads a file" app — this is the permanent foundation every future intelligence module (AI extraction, benchmarking, pricing recommendations) plugs into without a redesign:

```
Organisation → Users → Projects → Project Versions → BOQs → Processing Jobs
                                                                 ⇢ (future) AI Extraction
                                                                   → Construction Rate Engine
                                                                   → AI Benchmark Engine
                                                                   → Pricing Engine → Pricing Runs
                                                                   → Exports
Audit Log (append-only)        — records uploads, payments, logins, settings changes, org-wide
Project Timeline               — per-project milestone feed (created, uploaded, paid, ...)
```

**Organisation** is currently 1:1 with a user — every sign-up auto-provisions one (`handle_new_user()` in `00000000000004_enterprise_architecture.sql`), and every table below is scoped to `organisation_id`, not `user_id`. That's deliberate: adding multi-seat organisations later (inviting teammates into the same org) is a membership/invite feature on top of this schema, not a migration of every table's access-control model.

### Database relationships

| Table | Purpose |
| --- | --- |
| `organisations` | Tenant boundary. Everything else is scoped to one. |
| `profiles` | One per user; adds `organisation_id`, `role` (`user`/`admin`), free-trial and lifetime-usage counters. |
| `projects` | The rich tender record (client, contractor, tender/contract number, location, sector, value, dates, status, notes) — see the Projects section of the app for the full field list. |
| `project_versions` | One immutable row per BOQ upload event ("Original BOQ", "Revision 1", ...). Never updated. |
| `boqs` | The file-derived pricing decision for one version (filename, size, page count, tier, price) — the source PDF itself is never stored anywhere. |
| `processing_jobs` | 1:1 with a `boq`. The single source of truth for pipeline status (see Processing Jobs below). |
| `pricing_runs` | Schema-ready for the future Pricing Engine's output (AI recommendation, approved rates, confidence scores, benchmark results). Nothing writes to it yet; a trigger makes a run read-only once `completed_at` is set. |
| `exports` | Schema-ready for generated Excel/PDF exports. Nothing writes to it yet. |
| `rate_library_items` | Schema-ready Construction Rate Engine table (normalised descriptions, categories, units, material classification, historical stats, a `vector(1536)` embedding column). Nothing writes to it yet. |
| `audit_log` | Append-only (no update/delete RLS policy exists, so both are denied by default). |
| `project_timeline` | Per-project milestone feed, distinct from the audit log's compliance/security purpose. |
| `payments` | Unchanged from before — still provider-independent, now optionally linked to a `boq_id`. |

### Version control strategy

A BOQ upload never overwrites anything. Each upload creates a new `project_versions` row (`version_number` auto-incrementing per project, labeled "Original BOQ" for version 1 and "Revision N" thereafter) and a new linked `boqs` row. The Project Dashboard's "BOQ versions" panel lists every version permanently — there is no edit/delete path for a version once created.

### Processing pipeline & Processing Jobs

Every upload creates a `processing_jobs` row (`src/lib/actions/boq.ts`), which is the single source of truth for where a BOQ is in its lifecycle:

```
UPLOADED → WAITING_FOR_PAYMENT → PAYMENT_VERIFIED → QUEUED → PREPARING_DOCUMENT
  → AI_EXTRACTION → NORMALISING_DATA → BENCHMARKING → RATE_RECOMMENDATION
  → GENERATING_EXPORT → COMPLETED  (or FAILED / CANCELLED at any point)
```

**No AI extraction, benchmarking, or pricing recommendation is implemented yet** — this pass is plumbing only. In practice today: a free-trial BOQ's job goes straight to `QUEUED`; a paid BOQ's job sits at `WAITING_FOR_PAYMENT` until `PaymentService.processITN()` advances it to `QUEUED`. Nothing currently picks a `QUEUED` job up — there is no worker — so the Processing Screen (`/dashboard/projects/[id]/boq/[boqId]/processing`) honestly shows "queued, processing modules launching soon" rather than faking progress. `src/lib/processing/status.ts` holds the stage order, friendly labels, and progress-percentage calculation, ready for a future worker to drive jobs the rest of the way through.

### Audit trail

`src/lib/audit/log-event.ts` exposes `logAuditEvent()`, called from: `login()`, profile settings updates, BOQ upload, and `PaymentService.processITN()`'s payment-completion branch. The `audit_log` table has no update/delete RLS policy for any role, so once written a row can't be edited — only appended to and read (scoped to the caller's organisation). Download, pricing-change, and export events are typed into `AuditEventType` (`src/lib/audit/log-event.ts`) ready to call once those features exist.

### Admin dashboard

`/dashboard/admin` is gated on `profiles.role === 'admin'` (checked with the normal session client, so a non-admin gets a 404, not a data leak) and then queries via the service-role client — the one place in the app allowed to see across all organisations — for platform-wide counts: projects, users, revenue, active/completed/failed jobs, average processing time, pages processed, BOQs uploaded, pricing runs, payments. Flip a user to `admin` directly in Supabase; there's no invite UI for staff yet.

### Future AI integration

Everything the AI modules will need already exists as schema: `processing_jobs` has the stage machine to advance through, `rate_library_items` is ready for normalised/embedded line items keyed to the organisation that generated them, and `pricing_runs`/`exports` are ready to receive a real AI recommendation, confidence scores, and generated files. None of that logic exists yet — implementing it is a matter of writing a worker that consumes `QUEUED` jobs and starts writing to these tables, not redesigning them.

## Payment & pricing architecture

The application never talks to PayFast (or any payment provider) directly:

```
Application → Pricing Engine → Payment Service → PayFast (or a future provider)
```

- **Pricing Engine** (`src/lib/pricing/`) decides *what something costs*, before any payment starts. `PricingEngine` (`pricing-engine.ts`) wraps a swappable `PricingStrategy` (`types.ts`); `getPricingEngine()` is the single factory the app calls. V1 ships one strategy, `PageCountPricingStrategy` (`strategies/page-count-strategy.ts`), which reads its tiers from `src/config/pricing.ts` — the one file to edit to change pricing, with no code changes required. Adding a future strategy (item count, subscriptions, coupons, negotiated enterprise pricing) means implementing `PricingStrategy` and swapping it into the factory.
- **Payment Service** (`src/lib/payments/`) decides *how a price gets collected*. `PaymentService` (`service.ts`, exposed via `getPaymentService()`) is the only thing routes and Server Actions call — it persists the `payments` row and delegates to whichever `PaymentProvider` is configured (`PayFastPaymentProvider` today, via `getPaymentProvider()` in `provider-factory.ts`, switched by the `PAYMENT_PROVIDER` env var). Adding Ozow, Yoco, Peach Payments, or Stripe later means implementing `PaymentProvider` and adding one case to that factory — nothing else in the app changes. `PaymentService` also exposes `getPaymentStatus`/`verifyPayment` for status checks, and `cancelPayment`/`refundPayment` as placeholders no provider implements yet.

### Free trial & page-based pricing

Every new user gets **one free BOQ**, capped at 20 pages, tracked on `profiles` (`free_boq_used`, `free_boq_used_at`) alongside lifetime usage (`paid_boq_count`, `total_pages_processed`, `lifetime_spend`). Beyond that first free BOQ, price is page-count only (no subscriptions, no item-based pricing at this stage):

| Pages | Price |
| --- | --- |
| 1–20 | R49 (FREE for a user's first BOQ) |
| 21–50 | R99 |
| 51–100 | R199 |
| 101–250 | R349 |
| 250+ | "Please contact us for Enterprise Pricing." |

**BOQ flow:**
1. User uploads a PDF on `/dashboard/projects/[id]/boq/upload` → the `uploadBoq` Server Action (`src/lib/actions/boq.ts`) reads the file's page count in-memory via `pdf-lib` (`src/lib/boq/pdf.ts`) and **discards the file — it is never stored**, in the app or in Supabase.
2. It checks free-trial eligibility (`src/lib/pricing/free-trial.ts`) and calls the Pricing Engine to get a tier/price, then creates a `project_versions` row, a linked `boqs` row recording the pricing decision, and a `processing_jobs` row (free BOQs are marked used immediately and their job goes straight to `QUEUED`, since there's no payment step to gate them on).
3. The BOQ Processing Preview (`/dashboard/projects/[id]/boq/[boqId]`) shows project, filename, file size, page count, tier, price (or **FREE**, or the enterprise contact message), an estimated processing time, and status.
4. For a priced BOQ, **Proceed to Payment** posts to `/api/boq/[id]/pay`, which hands the *already-decided* price straight to `PaymentService.createPayment()` — the amount is never re-derived from anything the client sends.
5. On the PayFast ITN completing the payment, `PaymentService.processITN()` advances the linked `processing_jobs` row to `QUEUED`, records a `project_timeline` "payment received" entry, and increments the user's `profiles` usage counters.

The existing subscription plan (`/dashboard/billing`, `src/config/billing.ts`) is unchanged and shares the same `PaymentService`/`payments` table, just without a `boq_id`.

### PayFast integration

**Flow:**
1. Buyer confirms a price (BOQ Summary's **Proceed to Payment**, or **Pay with PayFast** on `/dashboard/billing`) → the relevant route calls `PaymentService.createPayment()`.
2. That inserts a `pending` row in `payments`, asks `PayFastPaymentProvider` to build a signed PayFast request, and responds with a self-submitting HTML form that POSTs the buyer to PayFast's hosted payment page (sandbox or production, per `PAYFAST_MODE`).
3. After paying, PayFast redirects the browser to `/payments/success` or `/payments/cancelled`. These pages read the payment's *current* status from Supabase (and its linked BOQ, if any) — they don't mark anything as paid themselves.
4. Independently, PayFast POSTs an **ITN** (Instant Transaction Notification) to `/api/payments/payfast/itn`, which just forwards to `PaymentService.processITN()`. That's the only thing that ever marks a payment `complete`, after all of:
   - **Signature check** — recomputes the MD5 signature from the posted fields and compares.
   - **Source IP check** — resolves PayFast's known hostnames and confirms the request came from one of their IPs.
   - **Postback validation** — POSTs the raw payload back to PayFast's `validate` endpoint and requires a `VALID` response.
   - **Amount check** — the notified amount must match the amount recorded when the payment was created.

### Testing locally

PayFast can't reach `localhost`, so ITN testing needs a public URL:

```bash
npx ngrok http 3000
```

Set `NEXT_PUBLIC_SITE_URL` to the `https://*.ngrok-free.app` URL ngrok prints, restart `npm run dev`, then go through the flow at that URL. Leave `PAYFAST_MODE=sandbox` and the merchant ID/key blank to use PayFast's public sandbox test merchant — no PayFast account needed. On the sandbox payment page, use PayFast's [published test card/EFT details](https://developers.payfast.co.za/docs#testing) to complete a payment, then check the `payments` table (or `/dashboard/billing`) for the status flipping to `complete` once the ITN lands.

Without a tunnel, the create → redirect → sandbox checkout flow still works end to end; only the final ITN webhook (and therefore the `complete` status) won't arrive.

## Deploying to Vercel

1. Push this repository to GitHub (already connected to `origin`).
2. Import the repo in [Vercel](https://vercel.com/new).
3. Add the environment variables from `.env.example` in the Vercel project settings (Production and Preview) — set `PAYFAST_MODE=production` and your real merchant ID/key/passphrase for the Production environment.
4. In your PayFast merchant dashboard, set the notify URL your integration uses to `https://<your-domain>/api/payments/payfast/itn` (the app also sends this per-request, but PayFast's dashboard settings can override/restrict it depending on your account settings).
5. Deploy — Vercel auto-detects Next.js, no additional build configuration is required.
