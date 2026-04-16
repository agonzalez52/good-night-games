-- AlterTable
ALTER TABLE "su_custom_survey_collections" RENAME CONSTRAINT "custom_survey_collections_pkey" TO "su_custom_survey_collections_pkey";

-- AlterTable
ALTER TABLE "su_custom_surveys" RENAME CONSTRAINT "custom_surveys_pkey" TO "su_custom_surveys_pkey";

-- AlterTable
ALTER TABLE "su_survey_answers" RENAME CONSTRAINT "survey_answers_pkey" TO "su_survey_answers_pkey";

-- AlterTable
ALTER TABLE "su_survey_packs" RENAME CONSTRAINT "survey_packs_pkey" TO "su_survey_packs_pkey";

-- AlterTable
ALTER TABLE "su_survey_questions" RENAME CONSTRAINT "survey_questions_pkey" TO "su_survey_questions_pkey";

-- AlterTable
ALTER TABLE "su_survey_showdown_sessions" RENAME CONSTRAINT "survey_showdown_sessions_pkey" TO "su_survey_showdown_sessions_pkey";

-- CreateTable
CREATE TABLE "su_survey_pack_tags" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "su_survey_pack_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "su_survey_pack_tags_pack_id_idx" ON "su_survey_pack_tags"("pack_id");

-- RenameForeignKey
ALTER TABLE "su_survey_answers" RENAME CONSTRAINT "survey_answers_question_id_fkey" TO "su_survey_answers_question_id_fkey";

-- RenameForeignKey
ALTER TABLE "su_survey_questions" RENAME CONSTRAINT "survey_questions_pack_id_fkey" TO "su_survey_questions_pack_id_fkey";

-- AddForeignKey
ALTER TABLE "su_survey_pack_tags" ADD CONSTRAINT "su_survey_pack_tags_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "su_survey_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "survey_answers_question_id_display_order_idx" RENAME TO "su_survey_answers_question_id_display_order_idx";

-- RenameIndex
ALTER INDEX "survey_questions_pack_id_display_order_idx" RENAME TO "su_survey_questions_pack_id_display_order_idx";

-- RenameIndex
ALTER INDEX "survey_showdown_sessions_session_id_key" RENAME TO "su_survey_showdown_sessions_session_id_key";
