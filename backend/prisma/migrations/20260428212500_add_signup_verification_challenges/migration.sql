-- CreateTable
create table "signup_verification_challenges" (
    "id" text not null,
    "user_id" text not null,
    "token_hash" text not null,
    "expires_at" timestamptz(3) not null,
    "used_at" timestamptz(3),
    "created_at" timestamptz(3) not null default current_timestamp,

    constraint "signup_verification_challenges_pkey" primary key ("id")
);

-- CreateIndex
create unique index "signup_verification_challenges_token_hash_key"
on "signup_verification_challenges"("token_hash");

-- CreateIndex
create index "signup_verification_challenges_user_id_idx"
on "signup_verification_challenges"("user_id");
