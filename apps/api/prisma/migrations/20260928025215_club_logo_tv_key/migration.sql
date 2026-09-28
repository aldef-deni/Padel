-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "logoFile" TEXT,
ADD COLUMN     "tvKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Club_tvKey_key" ON "Club"("tvKey");
