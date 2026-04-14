-- Rename judge_cache.survey_id → survey_answer_id (values are board keys: ordered answer row ids, see schema comment).

ALTER TABLE "judge_cache" RENAME COLUMN "survey_id" TO "survey_answer_id";

ALTER INDEX "judge_cache_game_id_input_text_survey_id_key" RENAME TO "judge_cache_game_id_input_text_survey_answer_id_key";
