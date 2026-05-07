-- Survey Showdown tables: align physical names with Prisma `su_*` models
ALTER TABLE "survey_packs" RENAME TO "su_survey_packs";
ALTER TABLE "survey_questions" RENAME TO "su_survey_questions";
ALTER TABLE "survey_answers" RENAME TO "su_survey_answers";
ALTER TABLE "custom_surveys" RENAME TO "su_custom_surveys";
ALTER TABLE "custom_survey_collections" RENAME TO "su_custom_survey_collections";
ALTER TABLE "survey_showdown_sessions" RENAME TO "su_survey_showdown_sessions";
