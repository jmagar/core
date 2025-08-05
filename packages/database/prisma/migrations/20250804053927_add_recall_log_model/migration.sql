-- CreateTable
CREATE TABLE "RecallLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),
    "accessType" TEXT NOT NULL,
    "query" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "searchMethod" TEXT,
    "minSimilarity" DOUBLE PRECISION,
    "maxResults" INTEGER,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "similarityScore" DOUBLE PRECISION,
    "context" TEXT,
    "source" TEXT,
    "sessionId" TEXT,
    "responseTimeMs" INTEGER,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "conversationId" TEXT,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "RecallLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RecallLog" ADD CONSTRAINT "RecallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallLog" ADD CONSTRAINT "RecallLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallLog" ADD CONSTRAINT "RecallLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
