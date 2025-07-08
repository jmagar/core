-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),
    "text" TEXT NOT NULL,
    "sourceURL" TEXT,
    "integrationAccountId" TEXT,
    "rejectionReason" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationAccount" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),
    "integrationConfiguration" JSONB NOT NULL,
    "accountId" TEXT,
    "settings" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "integratedById" TEXT NOT NULL,
    "integrationDefinitionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationDefinitionV2" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "config" JSONB,
    "spec" JSONB NOT NULL DEFAULT '{}',
    "version" TEXT,
    "url" TEXT,
    "workspaceId" TEXT,

    CONSTRAINT "IntegrationDefinitionV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookConfiguration" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "eventTypes" TEXT[],
    "userId" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDeliveryLog" (
    "id" TEXT NOT NULL,
    "webhookConfigurationId" TEXT NOT NULL,
    "activityId" TEXT,
    "status" "WebhookDeliveryStatus" NOT NULL,
    "responseStatusCode" INTEGER,
    "responseBody" TEXT,
    "error" TEXT,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_accountId_integrationDefinitionId_worksp_key" ON "IntegrationAccount"("accountId", "integrationDefinitionId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationDefinitionV2_name_key" ON "IntegrationDefinitionV2"("name");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_integratedById_fkey" FOREIGN KEY ("integratedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_integrationDefinitionId_fkey" FOREIGN KEY ("integrationDefinitionId") REFERENCES "IntegrationDefinitionV2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationDefinitionV2" ADD CONSTRAINT "IntegrationDefinitionV2_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookConfiguration" ADD CONSTRAINT "WebhookConfiguration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookConfiguration" ADD CONSTRAINT "WebhookConfiguration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeliveryLog" ADD CONSTRAINT "WebhookDeliveryLog_webhookConfigurationId_fkey" FOREIGN KEY ("webhookConfigurationId") REFERENCES "WebhookConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDeliveryLog" ADD CONSTRAINT "WebhookDeliveryLog_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
