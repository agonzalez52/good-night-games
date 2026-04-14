-- One cache row per (game, normalized input, canonical answer id). `survey_answers.id` is globally unique; custom `ss:qa:*` is stable per QA pair.
-- Only successful matches are stored (see judge route). Drop board scoping column.

TRUNCATE TABLE "judge_cache";

ALTER TABLE "judge_cache" DROP COLUMN "board_key";

ALTER TABLE "judge_cache" ALTER COLUMN "survey_answer_id" SET NOT NULL;

DROP INDEX IF EXISTS "judge_cache_game_id_input_text_board_key_key";

CREATE UNIQUE INDEX "judge_cache_game_id_input_text_survey_answer_id_key" ON "judge_cache"("game_id", "input_text", "survey_answer_id");
