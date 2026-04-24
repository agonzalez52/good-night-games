-- AlterTable: optional display title; blank titles are stored as NULL.
ALTER TABLE "su_custom_surveys" ALTER COLUMN "name" DROP NOT NULL;
