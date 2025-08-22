/*
  Warnings:

  - You are about to drop the `MCPSessionLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MCPSessionLog" DROP CONSTRAINT "MCPSessionLog_mcpSessionId_fkey";

-- AlterTable
ALTER TABLE "MCPSession" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted" TIMESTAMP(3);

-- DropTable
DROP TABLE "MCPSessionLog";
