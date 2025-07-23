-- AlterTable
ALTER TABLE "OAuthClient" ADD COLUMN     "webhookSecret" TEXT,
ADD COLUMN     "webhookUrl" TEXT;

-- CreateTable
CREATE TABLE "OAuthIntegrationGrant" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "integrationAccountId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthIntegrationGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthIntegrationGrant_clientId_userId_integrationAccountId_key" ON "OAuthIntegrationGrant"("clientId", "userId", "integrationAccountId");

-- AddForeignKey
ALTER TABLE "OAuthIntegrationGrant" ADD CONSTRAINT "OAuthIntegrationGrant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthIntegrationGrant" ADD CONSTRAINT "OAuthIntegrationGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthIntegrationGrant" ADD CONSTRAINT "OAuthIntegrationGrant_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "IntegrationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
