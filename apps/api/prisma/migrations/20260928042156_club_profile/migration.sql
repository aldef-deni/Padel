-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "city" TEXT,
ADD COLUMN     "closeTime" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mapsUrl" TEXT,
ADD COLUMN     "openTime" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "website" TEXT;
