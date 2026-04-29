## Add Payments: Institution Licenses and Per-Exam Credits (Paddle)

### Overview
Integrate Lovable's built-in payments (Paddle) to sell per-exam credit packs and institution-wide yearly licenses. Paddle is Merchant of Record — it handles tax, invoicing, and compliance globally. No monthly fee; 5% + 50¢ per transaction.

### Step 1 — Enable Paddle (test environment)
Run the eligibility check, then enable Paddle. A sandbox is created immediately so checkout can be tested without real money. Going live later requires a short Paddle verification.

### Step 2 — Create products (placeholder pricing, easy to change)
| Product | Type | Placeholder price | Grants |
|---|---|---|---|
| Starter Credit Pack | One-time | $19 | 10 exam analyses |
| Growth Credit Pack | One-time | $79 | 50 exam analyses |
| Institution License | Yearly subscription | $499/yr | Unlimited exams for everyone at one institution |

### Step 3 — Database changes (migration)
- Add `credits` (integer, default 0) to `profiles`.
- Create `institution_licenses` table:
  - `id uuid pk`, `institution text`, `purchased_by uuid`, `expires_at timestamptz`, `paddle_subscription_id text`, `status text`, timestamps.
  - RLS: a user can read a license row if `profiles.institution` (their own) matches `institution_licenses.institution`. Only service role writes.
- Add helper SQL function `has_active_license(_user_id uuid)` (SECURITY DEFINER) that checks if the user's institution has an active, non-expired license — used by the edge function and UI.

### Step 4 — Webhook edge function `handle-paddle-webhook`
- Verifies Paddle signature, parses event.
- On successful one-time purchase → increment `profiles.credits` by the pack size for the buyer.
- On subscription created/renewed → upsert `institution_licenses` for the buyer's institution with new `expires_at`.
- On subscription cancelled/expired → mark license `status = 'cancelled'`.
- Uses service role key; deployed automatically.

### Step 5 — Pricing page (`/pricing`)
- New route + sidebar link "Pricing".
- Shows the 3 plans with Paddle checkout buttons.
- Header chip shows current credit balance and (if applicable) institution license status + renewal date.

### Step 6 — Pre-flight gate in exam analysis
- Before calling `analyze-exam`, check: institution license active OR `credits > 0`.
- If neither → show a friendly modal "You're out of credits" with a Pricing CTA; block the upload.
- After a successful analysis (and no active license), decrement `credits` by 1 in the edge function.

### Step 7 — Tracking who subscribed
Two layers, automatically kept in sync:
- **Paddle Dashboard** — full customer/subscription/revenue management, renewals, refunds, invoices.
- **In-app** — `profiles.credits` per user; `institution_licenses` per institution. Optional simple "Billing" view in Settings showing current balance, license status, and a link to manage their Paddle subscription (Paddle-hosted customer portal).

### Costs to expect (recap)
- Paddle: 5% + 50¢ per transaction. No monthly fee.
- Lovable Cloud: $25/mo free balance.
- Lovable AI Gateway: $1/mo free balance, then usage-based.

### What I need from you to start
Just confirm and I'll: (1) run the eligibility check, (2) enable Paddle, (3) create the 3 placeholder products, (4) ship the schema + webhook + pricing page + credit gate. Pricing/quantities can be edited any time afterward.
