-- CreateTable
CREATE TABLE "game_config" (
    "game_id" TEXT NOT NULL,
    "game_name" TEXT NOT NULL,
    "tokens_per_game" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_config_pkey" PRIMARY KEY ("game_id")
);

-- Seed Survey Showdown (idempotent)
INSERT INTO "game_config" ("game_id", "game_name", "tokens_per_game", "is_active", "created_at", "updated_at")
VALUES ('survey_showdown', 'Survey Showdown', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("game_id") DO UPDATE SET
    "game_name" = EXCLUDED."game_name",
    "tokens_per_game" = EXCLUDED."tokens_per_game",
    "is_active" = EXCLUDED."is_active",
    "updated_at" = CURRENT_TIMESTAMP;
