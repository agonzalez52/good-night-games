# Supabase routines and triggers — edit and deploy workflow

Custom PostgreSQL **functions** and **triggers** that live outside the Prisma schema (auth signup, referral automation) are versioned in this repo and applied through **Prisma migrations**, not ad hoc SQL Editor edits.

Use this runbook when changing signup/referral behavior, fixing trigger bugs, or onboarding agents to database work.

## What is versioned

| Artifact | Path | Applied how |
|----------|------|-------------|
| Canonical SQL (edit here first) | [`supabase-public-routines.sql`](./supabase-public-routines.sql) | Not auto-applied — reference only |
| Deployable migration | `backend/prisma/migrations/<timestamp>_<name>/migration.sql` | `prisma migrate deploy` (staging/production) or `prisma migrate dev` (local) |
| Enum / status casting notes | [`referral-status-enum-supabase-sql.md`](./referral-status-enum-supabase-sql.md) | Same migration flow when enum labels change |

### Objects in the baseline snapshot

**Functions** (`public`):

- `handle_new_user` — creates `public.users` + `public.user_tokens` on `auth.users` insert
- `ensure_pending_referral_for_user` — creates capped `PENDING` referral from auth metadata
- `trg_ensure_pending_referral_from_auth_user` — trigger wrapper on auth user insert/update
- `trg_retry_pending_referral_on_public_user` — retry when `public.users` row appears/updates

**Triggers**:

| Trigger | Table | Event |
|---------|-------|-------|
| `on_auth_user_created` | `auth.users` | `AFTER INSERT` |
| `on_auth_user_referral_ensure` | `auth.users` | `AFTER INSERT OR UPDATE OF raw_user_meta_data` |
| `on_public_user_referral_retry` | `public.users` | `AFTER INSERT OR UPDATE OF referral_code, referred_by` |

Baseline migration that codifies the full snapshot: `20260526120000_supabase_public_routines`.

Prerequisite tables/types come from earlier Prisma migrations (`users`, `referrals`, `"ReferralStatus"`, `product_policy`, etc.). Do not redefine them in routine migrations unless you are intentionally extending the schema.

---

## Edit → migrate → deploy (agents and humans)

### 1. Edit the canonical snapshot

1. Open [`supabase-public-routines.sql`](./supabase-public-routines.sql).
2. Change function bodies and/or trigger DDL there.
3. Keep header comments accurate (object list, prerequisites, policy keys such as `max_referrals`).
4. If you touch `referrals.status`, read [`referral-status-enum-supabase-sql.md`](./referral-status-enum-supabase-sql.md) and use `'PENDING'::"ReferralStatus"` / `'CLAIMED'::"ReferralStatus"` — never bare lowercase strings.

`supabase-public-routines.sql` is the **single source of truth** for routine/trigger *logic*. Do not treat the Supabase SQL Editor as the source of truth.

### 2. Mirror into a new Prisma migration

1. From `backend/`:

   ```bash
   npx prisma migrate dev --name <descriptive_snake_name> --create-only
   ```

2. Open the generated `prisma/migrations/<timestamp>_<descriptive_snake_name>/migration.sql`.
3. Paste the updated SQL from the snapshot (functions + trigger section). Prefer copying the whole file’s function and trigger blocks so drift stays zero.
4. At the top of the migration file, keep a short comment pointing at the snapshot, for example:

   ```sql
   -- Canonical source: backend/docs/supabase-public-routines.sql (edit there first, then mirror here).
   ```

5. Use idempotent patterns already in the snapshot:
   - Functions: `CREATE OR REPLACE FUNCTION ...`
   - Triggers: `DROP TRIGGER IF EXISTS ... ON <table>;` then `CREATE TRIGGER ...`

6. **Never edit migrations that have already been applied** to staging or production. Always add a new migration.

7. Apply locally and review:

   ```bash
   npx prisma migrate dev
   ```

   If the change is SQL-only (no `schema.prisma` change), `migrate dev` still records the migration; confirm it runs cleanly against your local/staging database URL in `backend/.env`.

### 3. Staging validation

1. Point `DATABASE_URL` at the **staging** Supabase project (same project as local per project conventions).
2. Deploy pending migrations:

   ```bash
   npx prisma migrate deploy
   ```

3. Run the [post-deploy verification queries](#post-deploy-verification-drift-checks) below in the Supabase SQL Editor (or `psql`).
4. Smoke-test affected flows:
   - Email/password signup → `public.users` row + token row
   - Signup with `referral_code` in metadata → `PENDING` referral (respecting referrer cap)
   - OAuth referral claim path — see checklist in [`referral-status-enum-supabase-sql.md`](./referral-status-enum-supabase-sql.md#manual-verification-oauth-referral-claims-exactly-once)

### 4. Production promotion

1. Use the **same** migration folder committed on `main` (no environment-specific SQL).
2. Run `npx prisma migrate deploy` against production `DATABASE_URL` (or your CI/CD step that does equivalent).
3. Re-run verification queries on production.
4. Repeat smoke tests if the change touched referral or signup paths.

**Do not** re-apply logic only in the SQL Editor on one environment — that causes drift and the next migration may fight live definitions.

---

## When to change `schema.prisma` vs SQL-only migration

| Change | Approach |
|--------|----------|
| New column/table/enum on `public.*` | `schema.prisma` + `prisma migrate dev` |
| Trigger/function only (auth or `public` routines) | Edit snapshot → SQL-only migration (may use `--create-only`) |
| Both | Schema migration first if the function depends on new columns, then routine migration |

---

## Post-deploy verification (drift checks)

Run the same SQL on **staging** and **production** immediately after `npx prisma migrate deploy`. These queries read `pg_proc` / `pg_trigger` only — they do not mutate data.

Canonical expected objects (keep in sync with [`supabase-public-routines.sql`](./supabase-public-routines.sql)):

| Kind | Name | Binding |
|------|------|---------|
| Function | `handle_new_user` | — |
| Function | `ensure_pending_referral_for_user` | — |
| Function | `trg_ensure_pending_referral_from_auth_user` | — |
| Function | `trg_retry_pending_referral_on_public_user` | — |
| Trigger | `on_auth_user_created` | `auth.users` → `handle_new_user` |
| Trigger | `on_auth_user_referral_ensure` | `auth.users` → `trg_ensure_pending_referral_from_auth_user` |
| Trigger | `on_public_user_referral_retry` | `public.users` → `trg_retry_pending_referral_on_public_user` |

### Checklist (staging and production)

Copy this into a PR or deploy note and check each environment separately.

**Staging** (after `migrate deploy` on staging `DATABASE_URL`):

- [ ] **1. Drift summary** — `missing_functions = 0`, `missing_triggers = 0`, `unexpected_auth_triggers = 0`
- [ ] **2. Function inventory** — exactly 4 expected `public` function names
- [ ] **3. Trigger inventory** — exactly 3 triggers on the correct tables with correct `EXECUTE FUNCTION` targets
- [ ] **4. Smoke tests** — signup creates `public.users` + tokens; referral metadata creates capped `PENDING` referral (see staging section above)

**Production** (after `migrate deploy` on production `DATABASE_URL`):

- [ ] **1. Drift summary** — same zero counts as staging
- [ ] **2. Function inventory** — 4 rows, same names as staging
- [ ] **3. Trigger inventory** — 3 rows, same bindings as staging
- [ ] **4. Smoke tests** — repeat only if the migration touched signup/referral paths

If staging and production disagree on step 1–3, treat production as drifted — do not hand-patch in the SQL Editor; add a corrective Prisma migration from the snapshot.

### 1. Drift summary (run first)

Single pass: missing expected objects plus unexpected triggers on `auth.users`.

```sql
with expected_functions (function_name) as (
  values
    ('handle_new_user'),
    ('ensure_pending_referral_for_user'),
    ('trg_ensure_pending_referral_from_auth_user'),
    ('trg_retry_pending_referral_on_public_user')
),
expected_triggers (trigger_name, table_schema, table_name, function_name) as (
  values
    ('on_auth_user_created', 'auth', 'users', 'handle_new_user'),
    ('on_auth_user_referral_ensure', 'auth', 'users', 'trg_ensure_pending_referral_from_auth_user'),
    ('on_public_user_referral_retry', 'public', 'users', 'trg_retry_pending_referral_on_public_user')
),
live_functions as (
  select p.proname as function_name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
live_triggers as (
  select
    t.tgname as trigger_name,
    n.nspname as table_schema,
    c.relname as table_name,
    pg_get_triggerdef(t.oid) as trigger_definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
),
missing_functions as (
  select ef.function_name
  from expected_functions ef
  left join live_functions lf on lf.function_name = ef.function_name
  where lf.function_name is null
),
missing_triggers as (
  select et.trigger_name, et.table_schema, et.table_name, et.function_name
  from expected_triggers et
  left join live_triggers lt
    on lt.trigger_name = et.trigger_name
   and lt.table_schema = et.table_schema
   and lt.table_name = et.table_name
   and lt.trigger_definition ilike '%' || et.function_name || '(%'
  where lt.trigger_name is null
),
unexpected_auth_triggers as (
  select lt.trigger_name, lt.trigger_definition
  from live_triggers lt
  where lt.table_schema = 'auth'
    and lt.table_name = 'users'
    and lt.trigger_name not in (select trigger_name from expected_triggers)
)
select 'missing_functions' as check_name, count(*)::int as issue_count
from missing_functions
union all
select 'missing_triggers', count(*)::int
from missing_triggers
union all
select 'unexpected_auth_triggers', count(*)::int
from unexpected_auth_triggers;
```

**Expected:** three rows, each with `issue_count = 0`.

If any count is non-zero, list the gaps:

```sql
with expected_functions (function_name) as (
  values
    ('handle_new_user'),
    ('ensure_pending_referral_for_user'),
    ('trg_ensure_pending_referral_from_auth_user'),
    ('trg_retry_pending_referral_on_public_user')
),
live_functions as (
  select p.proname as function_name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select ef.function_name as missing_function
from expected_functions ef
left join live_functions lf on lf.function_name = ef.function_name
where lf.function_name is null
order by ef.function_name;
```

```sql
with expected_triggers (trigger_name, table_schema, table_name, function_name) as (
  values
    ('on_auth_user_created', 'auth', 'users', 'handle_new_user'),
    ('on_auth_user_referral_ensure', 'auth', 'users', 'trg_ensure_pending_referral_from_auth_user'),
    ('on_public_user_referral_retry', 'public', 'users', 'trg_retry_pending_referral_on_public_user')
),
live_triggers as (
  select
    t.tgname as trigger_name,
    n.nspname as table_schema,
    c.relname as table_name,
    pg_get_triggerdef(t.oid) as trigger_definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
)
select
  et.trigger_name,
  et.table_schema,
  et.table_name,
  et.function_name as expected_function
from expected_triggers et
left join live_triggers lt
  on lt.trigger_name = et.trigger_name
 and lt.table_schema = et.table_schema
 and lt.table_name = et.table_name
 and lt.trigger_definition ilike '%' || et.function_name || '(%'
where lt.trigger_name is null
order by et.table_schema, et.table_name, et.trigger_name;
```

### 2. Custom `public` functions exist

```sql
select p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'handle_new_user',
    'ensure_pending_referral_for_user',
    'trg_ensure_pending_referral_from_auth_user',
    'trg_retry_pending_referral_on_public_user'
  )
order by p.proname;
```

**Expected:** 4 rows. Fewer rows means a missing or renamed function.

### 3. Triggers bound to the correct tables

```sql
select
  n.nspname as table_schema,
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and t.tgname in (
    'on_auth_user_created',
    'on_auth_user_referral_ensure',
    'on_public_user_referral_retry'
  )
order by n.nspname, c.relname, t.tgname;
```

**Expected:** 3 rows:

| `table_schema` | `table_name` | `trigger_name` | `trigger_definition` contains |
|----------------|--------------|----------------|-------------------------------|
| `auth` | `users` | `on_auth_user_created` | `handle_new_user` |
| `auth` | `users` | `on_auth_user_referral_ensure` | `trg_ensure_pending_referral_from_auth_user` |
| `public` | `users` | `on_public_user_referral_retry` | `trg_retry_pending_referral_on_public_user` |

Confirm event clauses match the snapshot (`AFTER INSERT` on auth signup; `AFTER INSERT OR UPDATE OF raw_user_meta_data` on auth referral; `AFTER INSERT OR UPDATE OF referral_code, referred_by` on `public.users`).

### 4. Optional: compare live function body to repo

Use when debugging “works in staging, wrong in prod”:

```sql
select pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'ensure_pending_referral_for_user';
```

Compare output to the matching block in [`supabase-public-routines.sql`](./supabase-public-routines.sql).

### 5. Detect unexpected extra triggers on `auth.users`

```sql
select t.tgname, pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth'
  and c.relname = 'users'
  and not t.tgisinternal
order by t.tgname;
```

**Expected:** only `on_auth_user_created` and `on_auth_user_referral_ensure`. Review any other names before dropping — remove only triggers you intentionally deleted in a migration.

---

## Agent checklist (short)

1. Read [`supabase-public-routines.sql`](./supabase-public-routines.sql) and related enum doc if status values are involved.
2. Implement changes in the snapshot file.
3. Create a **new** migration; mirror snapshot SQL; do not modify applied migrations.
4. Run `prisma migrate dev` locally; run tests if backend referral/signup code changed.
5. Document validation steps in the PR (verification SQL + smoke tests).
6. Staging `migrate deploy` → verification queries → smoke tests.
7. Production `migrate deploy` → same verification queries.

---

## Related files

- [`supabase-public-routines.sql`](./supabase-public-routines.sql) — canonical routine/trigger definitions
- [`referral-status-enum-supabase-sql.md`](./referral-status-enum-supabase-sql.md) — `ReferralStatus` enum casts and OAuth claim verification
- `backend/prisma/migrations/20260526120000_supabase_public_routines/` — full baseline for all custom routines/triggers
- `backend/prisma/migrations/20260522180000_referral_signup_cap/` — referrer cap logic inside `ensure_pending_referral_for_user` (superseded by snapshot for ongoing edits)
