-- Align ReferralStatus labels with PurchaseStatus (ALL_CAPS).

ALTER TABLE "referrals" ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "ReferralStatus" RENAME VALUE 'pending' TO 'PENDING';
ALTER TYPE "ReferralStatus" RENAME VALUE 'claimed' TO 'CLAIMED';

ALTER TABLE "referrals" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ReferralStatus";
