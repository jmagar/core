-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('Agent', 'User', 'System');

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),
    "unread" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),
    "message" TEXT NOT NULL,
    "userType" "UserType" NOT NULL,
    "activityId" TEXT,
    "context" JSONB,
    "thoughts" JSONB,
    "userId" TEXT,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "ConversationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationExecutionStep" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),
    "thought" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionId" TEXT,
    "actionOutput" TEXT,
    "actionInput" TEXT,
    "actionStatus" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "conversationHistoryId" TEXT NOT NULL,

    CONSTRAINT "ConversationExecutionStep_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationHistory" ADD CONSTRAINT "ConversationHistory_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationHistory" ADD CONSTRAINT "ConversationHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationHistory" ADD CONSTRAINT "ConversationHistory_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationExecutionStep" ADD CONSTRAINT "ConversationExecutionStep_conversationHistoryId_fkey" FOREIGN KEY ("conversationHistoryId") REFERENCES "ConversationHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
