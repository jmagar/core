-- DropForeignKey
ALTER TABLE "IngestionQueue" DROP CONSTRAINT "IngestionQueue_spaceId_fkey";

-- AlterTable
ALTER TABLE "IngestionQueue" ALTER COLUMN "spaceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "IngestionQueue" ADD CONSTRAINT "IngestionQueue_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;
