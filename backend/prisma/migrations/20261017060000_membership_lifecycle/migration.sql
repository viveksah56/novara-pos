ALTER TABLE "Membership"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Membership_tenantId_isActive_role_idx"
ON "Membership"("tenantId", "isActive", "role");
