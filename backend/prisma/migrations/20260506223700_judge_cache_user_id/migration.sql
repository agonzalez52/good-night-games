-- AlterTable
ALTER TABLE "judge_cache" ADD COLUMN "user_id" TEXT;

-- DropIndex
DROP INDEX "judge_cache_game_id_input_text_survey_answer_id_key";

-- CreateIndex: NULLS NOT DISTINCT so guest rows (user_id NULL) share one cache slot per key
CREATE UNIQUE INDEX "judge_cache_game_id_user_id_input_text_survey_answer_id_key" ON "judge_cache"("game_id", "user_id", "input_text", "survey_answer_id") NULLS NOT DISTINCT;
