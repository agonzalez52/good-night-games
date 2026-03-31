-- purpose: normalize survey pack rounds into relational tables.
-- affected:
--   - creates "survey_questions" and "survey_answers"
--   - backfills from "survey_packs"."rounds" jsonb
--   - drops "survey_packs"."rounds"
-- notes:
--   - preserves ordering using jsonb_array_elements(... with ordinality)
--   - uses gen_random_uuid() (built-in on postgres 13+) for new row ids
--   - fails fast if existing json does not match expected shape
--   - points may be json number or string; whole numbers only (e.g. 36, 36.0)

begin;

-- 1) create normalized tables
create table "survey_questions" (
    "id" text not null,
    "pack_id" text not null,
    "question" text not null,
    "display_order" integer not null,
    "created_at" timestamp(3) not null default current_timestamp,

    constraint "survey_questions_pkey" primary key ("id")
);

create table "survey_answers" (
    "id" text not null,
    "question_id" text not null,
    "text" text not null,
    "points" integer not null,
    "display_order" integer not null,

    constraint "survey_answers_pkey" primary key ("id")
);

create index "survey_questions_pack_id_display_order_idx"
    on "survey_questions" ("pack_id", "display_order");

create index "survey_answers_question_id_display_order_idx"
    on "survey_answers" ("question_id", "display_order");

alter table "survey_questions"
    add constraint "survey_questions_pack_id_fkey"
    foreign key ("pack_id") references "survey_packs" ("id")
    on delete cascade on update cascade;

alter table "survey_answers"
    add constraint "survey_answers_question_id_fkey"
    foreign key ("question_id") references "survey_questions" ("id")
    on delete cascade on update cascade;

-- 2) validate existing json payloads before writing anything
do $$
begin
    -- rounds must be an array
    if exists (
        select 1
        from "survey_packs" p
        where jsonb_typeof(p."rounds") <> 'array'
    ) then
        raise exception '"survey_packs"."rounds" must be a json array for all packs';
    end if;

    -- every round must have a non-empty question string and answers array
    if exists (
        select 1
        from "survey_packs" p
        cross join lateral jsonb_array_elements(p."rounds") as r(round)
        where
            jsonb_typeof(r.round) <> 'object'
            or coalesce(nullif(btrim(r.round->>'question'), ''), '') = ''
            or jsonb_typeof(r.round->'answers') <> 'array'
    ) then
        raise exception 'invalid round shape in "survey_packs"."rounds" (expected {question: string, answers: array})';
    end if;

    -- every answer must have non-empty text and a whole-number points value
    -- (json may store points as number or string; avoid strict regex on ->>'points' alone)
    if exists (
        select 1
        from "survey_packs" p
        cross join lateral jsonb_array_elements(p."rounds") as r(round)
        cross join lateral jsonb_array_elements(r.round->'answers') as a(answer)
        cross join lateral (
            select
                case jsonb_typeof(a.answer->'points')
                    when 'number' then (a.answer->'points')::text::numeric
                    when 'string' then btrim(a.answer->>'points')::numeric
                    else null::numeric
                end as pts
        ) as extracted
        where
            coalesce(nullif(btrim(a.answer->>'text'), ''), '') = ''
            or (a.answer ? 'points') is false
            or extracted.pts is null
            or extracted.pts <> floor(extracted.pts)
    ) then
        raise exception 'invalid answer shape in "survey_packs"."rounds" (expected {text: string, points: int})';
    end if;
end $$;

-- 3) backfill into survey_questions and survey_answers (preserve order)
with
rounds as (
    select
        p."id" as pack_id,
        (r.ord - 1)::int as round_index,
        r.round as round_json
    from "survey_packs" p
    cross join lateral jsonb_array_elements(p."rounds") with ordinality as r(round, ord)
),
inserted_questions as (
    insert into "survey_questions" ("id", "pack_id", "question", "display_order", "created_at")
    select
        gen_random_uuid()::text as id,
        rounds.pack_id,
        rounds.round_json->>'question' as question,
        rounds.round_index as display_order,
        current_timestamp as created_at
    from rounds
    returning "id", "pack_id", "display_order"
)
insert into "survey_answers" ("id", "question_id", "text", "points", "display_order")
select
    gen_random_uuid()::text as id,
    q."id" as question_id,
    a.answer->>'text' as text,
    round(extracted.pts)::int as points,
    (a.ord - 1)::int as display_order
from inserted_questions q
join rounds
  on rounds.pack_id = q."pack_id"
 and rounds.round_index = q."display_order"
cross join lateral jsonb_array_elements(rounds.round_json->'answers') with ordinality as a(answer, ord)
cross join lateral (
    select
        case jsonb_typeof(a.answer->'points')
            when 'number' then (a.answer->'points')::text::numeric
            when 'string' then btrim(a.answer->>'points')::numeric
            else null::numeric
        end as pts
) as extracted;

-- 4) drop old json column only after successful backfill
alter table "survey_packs" drop column "rounds";

commit;

