-- DropForeignKey
ALTER TABLE "OAuthClient" DROP CONSTRAINT "OAuthClient_createdById_fkey";

-- AlterTable
ALTER TABLE "OAuthClient" ADD COLUMN     "clientType" TEXT NOT NULL DEFAULT 'regular',
ALTER COLUMN "workspaceId" DROP NOT NULL,
ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "OAuthClient" ADD CONSTRAINT "OAuthClient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
