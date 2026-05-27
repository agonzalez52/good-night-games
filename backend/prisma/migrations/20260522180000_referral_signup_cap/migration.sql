-- Referrer referral cap on signup: do not insert into public.referrals when the
-- referrer (owner of the referral code) already has max_referrals rows (pending + claimed).
-- Keep product_policy.max_referrals in sync with backend MAX_REFERRALS (default 3).

CREATE TABLE IF NOT EXISTS "product_policy" (
    "key" TEXT NOT NULL,
    "value_int" INTEGER NOT NULL,
    CONSTRAINT "product_policy_pkey" PRIMARY KEY ("key")
);

INSERT INTO "product_policy" ("key", "value_int")
VALUES ('max_referrals', 3)
ON CONFLICT ("key") DO NOTHING;

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
