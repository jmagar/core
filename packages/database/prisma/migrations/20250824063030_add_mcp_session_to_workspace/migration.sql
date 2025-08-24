-- AlterTable
ALTER TABLE "MCPSession" ADD COLUMN     "workspaceId" TEXT;

-- AddForeignKey
ALTER TABLE "MCPSession" ADD CONSTRAINT "MCPSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
