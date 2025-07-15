-- AlterTable
ALTER TABLE "IngestionQueue" ADD COLUMN     "activityId" TEXT;

-- AddForeignKey
ALTER TABLE "IngestionQueue" ADD CONSTRAINT "IngestionQueue_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
