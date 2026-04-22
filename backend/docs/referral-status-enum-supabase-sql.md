# `referrals.status` enum — Supabase SQL compatibility

Prisma migration `20260421184700_referral_status_enum` creates a PostgreSQL enum; migration `20260421190000_referral_status_uppercase` renames labels to match `PurchaseStatus` (ALL_CAPS):

```sql
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'CLAIMED');
```

The column `public.referrals.status` has type `"ReferralStatus"` (not plain `text`).

## What you must change in Supabase (manual SQL)

Any trigger or function that **inserts or compares** `referrals.status` must use the **enum type**, not a bare string that PostgreSQL treats as `unknown` in a way that fails or mismatches.

### Inserts (e.g. `apply_pending_referral_for_user`)

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

Apply the **same** Prisma migrations (or equivalent `CREATE TYPE` + `ALTER COLUMN ... USING` + renames) on each Supabase project so the enum name and labels match. Then update your trigger functions in **SQL Editor** on each environment.

### If you see `invalid input value for enum "ReferralStatus"`

Valid labels are **`PENDING`** and **`CLAIMED`** only. Legacy lowercase `pending` / `claimed` were renamed by `20260421190000_referral_status_uppercase`.
