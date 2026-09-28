-- CreateTable
CREATE TABLE "ClubMember" (
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubMember_pkey" PRIMARY KEY ("clubId","userId")
);

-- CreateIndex
CREATE INDEX "ClubMember_userId_idx" ON "ClubMember"("userId");

-- AddForeignKey
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: pemain yang sudah pernah join sesi menjadi anggota klub tempat sesi itu.
INSERT INTO "ClubMember" ("clubId", "userId", "createdAt", "updatedAt")
SELECT c."clubId", sp."userId", MIN(sp."joinedAt"), NOW()
FROM "SessionPlayer" sp
JOIN "Session" s ON s."id" = sp."sessionId"
JOIN "Court" c ON c."id" = s."courtId"
JOIN "User" u ON u."id" = sp."userId" AND u."role" = 'PLAYER'
GROUP BY c."clubId", sp."userId"
ON CONFLICT DO NOTHING;
