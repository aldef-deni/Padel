-- OTP per channel: kolom phone menjadi target (nomor HP atau email).
CREATE TYPE "OtpChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');

ALTER TABLE "OtpCode" RENAME COLUMN "phone" TO "target";
ALTER TABLE "OtpCode" ADD COLUMN "channel" "OtpChannel" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "OtpCode" ALTER COLUMN "channel" DROP DEFAULT;

ALTER INDEX "OtpCode_phone_createdAt_idx" RENAME TO "OtpCode_target_createdAt_idx";
