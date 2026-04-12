-- Split board scoping from the matched answer: `board_key` = former pipe-joined ids; `survey_answer_id` = single matched row (nullable on miss).

ALTER TABLE "judge_cache" RENAME COLUMN "survey_answer_id" TO "board_key";

ALTER TABLE "judge_cache" ADD COLUMN "survey_answer_id" TEXT;

DROP INDEX "judge_cache_game_id_input_text_survey_answer_id_key";

CREATE UNIQUE INDEX "judge_cache_game_id_input_text_board_key_key" ON "judge_cache"("game_id", "input_text", "board_key");
