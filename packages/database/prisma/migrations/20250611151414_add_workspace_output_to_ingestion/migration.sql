/*
  Warnings:

  - Added the required column `workspaceId` to the `IngestionQueue` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "IngestionQueue" ADD COLUMN     "output" JSONB,
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "IngestionQueue" ADD CONSTRAINT "IngestionQueue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
