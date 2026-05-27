# `referrals.status` enum — Supabase SQL compatibility

Prisma migration `20260421184700_referral_status_enum` creates a PostgreSQL enum; migration `20260421190000_referral_status_uppercase` renames labels to match `PurchaseStatus` (ALL_CAPS):

```sql
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'CLAIMED');
```

The column `public.referrals.status` has type `"ReferralStatus"` (not plain `text`).

## What you must change in Supabase (manual SQL)

Any trigger or function that **inserts or compares** `referrals.status` must use the **enum type**, not a bare string that PostgreSQL treats as `unknown` in a way that fails or mismatches.

### Referrer cap on signup (`ensure_pending_referral_for_user`)

Before inserting a `PENDING` row, the function counts **all** referrals for the referrer
(`pending` + `claimed`) and compares to `product_policy.max_referrals` (default `3`,
keep in sync with backend `MAX_REFERRALS`). No row is created when the referrer is at cap.

Prisma migration: `20260522180000_referral_signup_cap`.

### Inserts (e.g. `ensure_pending_referral_for_user`)

**Before (TEXT column — worked with `'pending'`):**

```sql
insert into public.referrals (referrer_id, referred_id, status, expires_at)
values (..., 'pending', ...);
```

**After (enum column — use an explicit cast):**

```sql
insert into public.referrals (id, referrer_id, referred_id, status, expires_at)
values (
  gen_random_uuid()::text,
  v_referrer_id,
  p_auth_user_id,
  'PENDING'::"ReferralStatus",
  (timezone('utc', now()) + interval '90 days')::timestamp
);
```

The important part is **`'PENDING'::"ReferralStatus"`** (schema-qualified name is `public."ReferralStatus"` if needed).

### Comparisons in SQL

Prefer comparing to the enum, e.g.:

```sql
and r.status = 'PENDING'::"ReferralStatus"
```

or

```sql
and r.status::text = 'PENDING'
```

(Second form works but loses type safety; first form matches Prisma.)

### Claim updates (if done in SQL)

Setting status to claimed:

```sql
update public.referrals
set status = 'CLAIMED'::"ReferralStatus", claimed_at = timezone('utc', now())
where id = ...;
```

### Staging vs production

Apply the **same** Prisma migrations (or equivalent `CREATE TYPE` + `ALTER COLUMN ... USING` + renames) on each Supabase project so the enum name and labels match.

For trigger/function changes (including enum casts inside `ensure_pending_referral_for_user`), follow **[database-routines-workflow.md](./database-routines-workflow.md)** — edit [`supabase-public-routines.sql`](./supabase-public-routines.sql) first, mirror into a new Prisma migration, then `migrate deploy` on staging and production. Do not maintain divergent copies in the Supabase SQL Editor per environment.

After each deploy, run the copy-paste **`pg_proc` / `pg_trigger` drift checks** in [database-routines-workflow.md § Post-deploy verification](./database-routines-workflow.md#post-deploy-verification-drift-checks) on that environment before smoke-testing referrals.

### If you see `invalid input value for enum "ReferralStatus"`

Valid labels are **`PENDING`** and **`CLAIMED`** only. Legacy lowercase `pending` / `claimed` were renamed by `20260421190000_referral_status_uppercase`.

## Manual verification: OAuth referral claims exactly once

Use this checklist after deploying SQL + app changes to confirm OAuth signups move referrals from `PENDING` to `CLAIMED` one time only.

1) Create a fresh referral OAuth signup (new referred account) and finish the OAuth callback flow once.

2) Verify a referral row exists for the referred user and is already claimed:

```sql
select id, referrer_id, referred_id, status, claimed_at
from public.referrals
where referred_id = '<referred_user_id>'
order by created_at desc
limit 1;
```

Expected: one row, `status = 'CLAIMED'`, and `claimed_at` is not null.

3) Verify there is no remaining pending row for that referred user:

```sql
select count(*) as pending_rows
from public.referrals
where referred_id = '<referred_user_id>'
  and status = 'PENDING'::"ReferralStatus";
```

Expected: `pending_rows = 0`.

4) Verify referral claim purchase rows were created exactly once (one row for referrer, one for referred):

```sql
select user_id, count(*) as purchase_rows
from public.purchases
where bundle_id = 'referral_claim_bonus'
  and stripe_checkout_session_id like 'referral_claim:%'
  and user_id in ('<referrer_user_id>', '<referred_user_id>')
group by user_id
order by user_id;
```

Expected: each user has exactly `1` row.

5) Verify repeated claims are idempotent by calling the claim endpoint again while authenticated as the referred user:

```bash
curl -X POST "$BACKEND_URL/api/referrals/claim" \
  -H "Authorization: Bearer <referred_user_jwt>"
```

Expected: response contains `"referralClaimed": false` and referred user balance is unchanged from step 2/4 outcomes.
