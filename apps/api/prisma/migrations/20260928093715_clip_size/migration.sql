-- AlterTable
ALTER TABLE "Clip" ADD COLUMN     "sizeBytes" INTEGER;

-- CreateIndex
CREATE INDEX "Clip_createdAt_idx" ON "Clip"("createdAt");
