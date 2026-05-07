-- ReferralStatus enum replaces TEXT on referrals.status.
-- Normalize legacy values (e.g. uppercase PENDING from manual SQL) to enum labels.

CREATE TYPE "ReferralStatus" AS ENUM ('pending', 'claimed');

ALTER TABLE "referrals" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "referrals" ALTER COLUMN "status" TYPE "ReferralStatus" USING (
  CASE lower(trim("status"::text))
    WHEN 'pending' THEN 'pending'::"ReferralStatus"
    WHEN 'claimed' THEN 'claimed'::"ReferralStatus"
    ELSE 'pending'::"ReferralStatus"
  END
);

ALTER TABLE "referrals" ALTER COLUMN "status" SET DEFAULT 'pending'::"ReferralStatus";
