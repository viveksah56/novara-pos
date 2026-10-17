CREATE TABLE "TeamInvitation" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "role" "BusinessRole" NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "invitedById" UUID NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeamInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeamInvitation_tokenHash_key" ON "TeamInvitation"("tokenHash");
CREATE INDEX "TeamInvitation_tenantId_email_createdAt_idx" ON "TeamInvitation"("tenantId", "email", "createdAt");
CREATE INDEX "TeamInvitation_tenantId_revokedAt_acceptedAt_expiresAt_idx" ON "TeamInvitation"("tenantId", "revokedAt", "acceptedAt", "expiresAt");

CREATE TABLE "TeamInvitationBranch" (
  "id" UUID NOT NULL,
  "invitationId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamInvitationBranch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TeamInvitationBranch_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "TeamInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeamInvitationBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeamInvitationBranch_invitationId_branchId_key" ON "TeamInvitationBranch"("invitationId", "branchId");
CREATE INDEX "TeamInvitationBranch_branchId_idx" ON "TeamInvitationBranch"("branchId");
