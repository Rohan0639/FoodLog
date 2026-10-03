-- CreateEnum
CREATE TYPE "MacroSource" AS ENUM ('AI', 'LABEL', 'USER');

-- CreateTable
CREATE TABLE "FoodDictionaryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "baseUnit" VARCHAR(20) NOT NULL,
    "caloriesPerUnit" DOUBLE PRECISION NOT NULL,
    "proteinPerUnit" DOUBLE PRECISION NOT NULL,
    "carbsPerUnit" DOUBLE PRECISION NOT NULL,
    "fatPerUnit" DOUBLE PRECISION NOT NULL,
    "sugarPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fiberPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" "MacroSource" NOT NULL DEFAULT 'AI',
    "timesLogged" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodDictionaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodDictionaryEntry_userId_lastUsedAt_idx" ON "FoodDictionaryEntry"("userId", "lastUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FoodDictionaryEntry_userId_key_key" ON "FoodDictionaryEntry"("userId", "key");

-- AddForeignKey
ALTER TABLE "FoodDictionaryEntry" ADD CONSTRAINT "FoodDictionaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
