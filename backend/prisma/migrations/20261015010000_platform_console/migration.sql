-- Platform roles are independent from cafe BusinessRole memberships.
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT_AGENT');

CREATE TABLE "PlatformStaff" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformStaff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformStaff_userId_key" ON "PlatformStaff"("userId");
CREATE INDEX "PlatformStaff_role_createdAt_idx" ON "PlatformStaff"("role", "createdAt");
ALTER TABLE "PlatformStaff" ADD CONSTRAINT "PlatformStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SubscriptionPlan" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "priceMonthly" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NPR',
    "trialDays" INTEGER NOT NULL DEFAULT 14,
    "maxBranches" INTEGER,
    "maxStaff" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");
CREATE INDEX "SubscriptionPlan_isActive_createdAt_idx" ON "SubscriptionPlan"("isActive", "createdAt");

ALTER TABLE "Tenant" ADD COLUMN "planId" UUID;
CREATE INDEX "Tenant_planId_idx" ON "Tenant"("planId");
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
