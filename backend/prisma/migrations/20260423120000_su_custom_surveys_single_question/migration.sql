-- AlterTable: new shape for a single face-off line + answers array (replaces `questions` JSONB array of objects).
ALTER TABLE "su_custom_surveys" ADD COLUMN "question" TEXT;
ALTER TABLE "su_custom_surveys" ADD COLUMN "answers" JSONB;

-- 1) Preferred: exactly one in-app question in the array.
UPDATE "su_custom_surveys" AS s
SET
  "question" = (s."questions"->0->>'question'),
  "answers"  = s."questions"->0->'answers'
WHERE jsonb_typeof(s."questions") = 'array'
  AND jsonb_array_length(s."questions") = 1
  AND (s."questions"->0) IS NOT NULL
  AND jsonb_typeof(s."questions"->0) = 'object';

-- 2) If there were several in-app questions, keep the first (trim) so the rest can be split manually later
--    in new rows, not during this migration; without this, NOT NULL on the new columns is blocked.
UPDATE "su_custom_surveys" AS s
SET
  "question" = (s."questions"->0->>'question'),
  "answers"  = s."questions"->0->'answers'
WHERE s."question" IS NULL
  AND jsonb_typeof(s."questions") = 'array'
  AND jsonb_array_length(s."questions") > 1
  AND jsonb_typeof(s."questions"->0) = 'object';

-- 3) Legacy: a single object stored at the root (not a JSON array).
UPDATE "su_custom_surveys" AS s
SET
  "question" = s."questions"->>'question',
  "answers"  = s."questions"->'answers'
WHERE s."question" IS NULL
  AND jsonb_typeof(s."questions") = 'object';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "su_custom_surveys" u
    WHERE u."question" IS NULL
       OR u."answers" IS NULL
  ) THEN
    RAISE EXCEPTION
      'su_custom_surveys migration blocked: not all rows could be backfilled from "questions" (e.g. jsonb_array_length > 1, empty array, or bad JSON). Fix data (split or trim), then re-run the migration.'
      USING HINT = 'SELECT id, name, jsonb_array_length(questions) AS n FROM su_custom_surveys;';
  END IF;
END $$;

ALTER TABLE "su_custom_surveys" ALTER COLUMN "question" SET NOT NULL;
ALTER TABLE "su_custom_surveys" ALTER COLUMN "answers" SET NOT NULL;
ALTER TABLE "su_custom_surveys" DROP COLUMN "questions";
