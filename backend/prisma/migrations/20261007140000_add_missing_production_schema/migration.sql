-- CreateEnum
CREATE TYPE "LiveStatus" AS ENUM ('CREATED', 'STARTING', 'LIVE', 'ENDING', 'ENDED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportTargetType" ADD VALUE 'LIVE_STREAM';
ALTER TYPE "ReportTargetType" ADD VALUE 'LIVE_COMMENT';

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveStream" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "visibility" "PrivacyLevel" NOT NULL DEFAULT 'PUBLIC',
    "status" "LiveStatus" NOT NULL DEFAULT 'CREATED',
    "roomCode" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 0,
    "currentViewerCount" INTEGER NOT NULL DEFAULT 0,
    "peakViewerCount" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "isRecording" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveComment" (
    "id" UUID NOT NULL,
    "liveStreamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveViewer" (
    "id" UUID NOT NULL,
    "liveStreamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "isLive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LiveViewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveBan" (
    "id" UUID NOT NULL,
    "liveStreamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bannedById" UUID NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveReport" (
    "id" UUID NOT NULL,
    "liveStreamId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveStream_roomCode_key" ON "LiveStream"("roomCode");

-- CreateIndex
CREATE INDEX "LiveStream_ownerId_idx" ON "LiveStream"("ownerId");

-- CreateIndex
CREATE INDEX "LiveStream_status_idx" ON "LiveStream"("status");

-- CreateIndex
CREATE INDEX "LiveStream_roomCode_idx" ON "LiveStream"("roomCode");

-- CreateIndex
CREATE INDEX "LiveStream_createdAt_idx" ON "LiveStream"("createdAt");

-- CreateIndex
CREATE INDEX "LiveComment_liveStreamId_createdAt_idx" ON "LiveComment"("liveStreamId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveComment_userId_idx" ON "LiveComment"("userId");

-- CreateIndex
CREATE INDEX "LiveViewer_liveStreamId_idx" ON "LiveViewer"("liveStreamId");

-- CreateIndex
CREATE INDEX "LiveViewer_userId_idx" ON "LiveViewer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveViewer_liveStreamId_userId_key" ON "LiveViewer"("liveStreamId", "userId");

-- CreateIndex
CREATE INDEX "LiveBan_liveStreamId_idx" ON "LiveBan"("liveStreamId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveBan_liveStreamId_userId_key" ON "LiveBan"("liveStreamId", "userId");

-- CreateIndex
CREATE INDEX "LiveReport_liveStreamId_idx" ON "LiveReport"("liveStreamId");

-- CreateIndex
CREATE INDEX "LiveReport_reporterId_idx" ON "LiveReport"("reporterId");

-- CreateIndex
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");

-- CreateIndex
CREATE INDEX "Group_updatedAt_idx" ON "Group"("updatedAt");

-- CreateIndex
CREATE INDEX "Story_userId_expiresAt_idx" ON "Story"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveStream" ADD CONSTRAINT "LiveStream_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveComment" ADD CONSTRAINT "LiveComment_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveComment" ADD CONSTRAINT "LiveComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveViewer" ADD CONSTRAINT "LiveViewer_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveViewer" ADD CONSTRAINT "LiveViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveBan" ADD CONSTRAINT "LiveBan_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveBan" ADD CONSTRAINT "LiveBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveBan" ADD CONSTRAINT "LiveBan_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveReport" ADD CONSTRAINT "LiveReport_liveStreamId_fkey" FOREIGN KEY ("liveStreamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveReport" ADD CONSTRAINT "LiveReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

