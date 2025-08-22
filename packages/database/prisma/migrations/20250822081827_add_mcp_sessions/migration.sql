-- CreateTable
CREATE TABLE "MCPSession" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "integrations" TEXT[],

    CONSTRAINT "MCPSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MCPSessionLog" (
    "id" TEXT NOT NULL,
    "mcpSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted" TIMESTAMP(3),

    CONSTRAINT "MCPSessionLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MCPSessionLog" ADD CONSTRAINT "MCPSessionLog_mcpSessionId_fkey" FOREIGN KEY ("mcpSessionId") REFERENCES "MCPSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
