-- Canonical snapshot: custom public routines and related triggers (Good Night Games)
--
-- Purpose: human/agent-editable reference for Supabase auth + referral automation.
-- This file is NOT auto-applied. Workflow: backend/docs/database-routines-workflow.md
--
-- Live objects captured (staging baseline, 2026-05):
--   Functions: handle_new_user, ensure_pending_referral_for_user,
--              trg_ensure_pending_referral_from_auth_user, trg_retry_pending_referral_on_public_user
--   Triggers:  on_auth_user_created (auth.users),
--              on_auth_user_referral_ensure (auth.users),
--              on_public_user_referral_retry (public.users)
--
-- Prerequisite tables/types (from Prisma migrations, not redefined here):
--   public.users, public.user_tokens, public.referrals, public.product_policy
--   enum "ReferralStatus" ('PENDING', 'CLAIMED')
--   product_policy.max_referrals (default 3) — keep in sync with backend MAX_REFERRALS

-- =============================================================================
-- Functions (public schema)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_username text;
begin
  v_username := nullif(trim(new.raw_user_meta_data->>'username'), '');
  if v_username is null then
    v_username := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
  end if;
  if v_username is null then
    v_username := split_part(new.email, '@', 1);
  end if;

  insert into public.users (
    id, email, username, auth_provider, referral_code, email_verified, signup_tokens_credited
  )
  values (
    new.id,
    new.email,
    v_username,
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    false,
    false
  );

  -- optional: keep if you want a guaranteed zero-row at signup
  insert into public.user_tokens (id, user_id, balance, lifetime_purchased, lifetime_spent)
  values (gen_random_uuid()::text, new.id, 0, 0, 0);

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_pending_referral_for_user(p_auth_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_meta jsonb;
  v_code text;
  v_referrer_id text;
  v_max_referrals int;
  v_referral_count int;
begin
  select u.raw_user_meta_data
    into v_meta
  from auth.users u
  where u.id = p_auth_user_id::uuid;

  if v_meta is null then return; end if;

  v_code := upper(trim(v_meta->>'referral_code'));
  if v_code is null or v_code = '' then return; end if;

  if exists (
    select 1
    from public.referrals r
    where r.referred_id = p_auth_user_id
  ) then
    return;
  end if;

  select u.id
    into v_referrer_id
  from public.users u
  where u.referral_code = v_code;

  if v_referrer_id is null then return; end if;
  if v_referrer_id = p_auth_user_id then return; end if;

  select coalesce(
    (select pp.value_int from public.product_policy pp where pp.key = 'max_referrals'),
    3
  )
    into v_max_referrals;

  select count(*)::int
    into v_referral_count
  from public.referrals r
  where r.referrer_id = v_referrer_id;

  if v_referral_count >= v_max_referrals then return; end if;

  if exists (
    select 1
    from public.users u
    where u.id = p_auth_user_id
      and u.referred_by is not null
      and u.referred_by <> v_referrer_id
  ) then
    return;
  end if;

  insert into public.referrals (id, referrer_id, referred_id, status, expires_at)
  values (
    gen_random_uuid()::text,
    v_referrer_id,
    p_auth_user_id,
    'PENDING'::"ReferralStatus",
    (timezone('utc', now()) + interval '90 days')::timestamp
  );

  update public.users
     set referred_by = v_referrer_id
   where id = p_auth_user_id
     and (referred_by is null or referred_by = v_referrer_id);

exception
  when unique_violation then
    null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_ensure_pending_referral_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  perform public.ensure_pending_referral_for_user(new.id::text);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_retry_pending_referral_on_public_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  perform public.ensure_pending_referral_for_user(new.id::text);
  return new;
end;
$function$;

-- =============================================================================
-- Triggers (idempotent: drop then create)
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_referral_ensure ON auth.users;
CREATE TRIGGER on_auth_user_referral_ensure
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_ensure_pending_referral_from_auth_user();

DROP TRIGGER IF EXISTS on_public_user_referral_retry ON public.users;
CREATE TRIGGER on_public_user_referral_retry
  AFTER INSERT OR UPDATE OF referral_code, referred_by ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_retry_pending_referral_on_public_user();
