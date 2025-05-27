-- CreateEnum
CREATE TYPE "AuthenticationMethod" AS ENUM ('GOOGLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "authenticationMethod" "AuthenticationMethod" NOT NULL,
    "authenticationProfile" JSONB,
    "authenticationExtraParams" JSONB,
    "authIdentifier" TEXT,
    "displayName" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT true,
    "confirmedBasicDetails" BOOLEAN NOT NULL DEFAULT false,
    "referralSource" TEXT,
    "invitationCodeId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "personalAccessTokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalAccessToken" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedToken" JSONB NOT NULL,
    "obfuscatedToken" TEXT NOT NULL,
    "hashedToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_authIdentifier_key" ON "User"("authIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationCode_code_key" ON "AuthorizationCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalAccessToken_hashedToken_key" ON "PersonalAccessToken"("hashedToken");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationCode_code_key" ON "InvitationCode"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invitationCodeId_fkey" FOREIGN KEY ("invitationCodeId") REFERENCES "InvitationCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorizationCode" ADD CONSTRAINT "AuthorizationCode_personalAccessTokenId_fkey" FOREIGN KEY ("personalAccessTokenId") REFERENCES "PersonalAccessToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalAccessToken" ADD CONSTRAINT "PersonalAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
