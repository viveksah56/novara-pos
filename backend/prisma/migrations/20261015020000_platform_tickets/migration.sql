CREATE TYPE "PlatformTicketType" AS ENUM ('COMPLAINT', 'FEEDBACK', 'SUPPORT');
CREATE TYPE "PlatformTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "PlatformTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "PlatformTicket" (
  "id" UUID NOT NULL,
  "tenantId" UUID,
  "createdById" UUID NOT NULL,
  "assignedStaffId" UUID,
  "type" "PlatformTicketType" NOT NULL,
  "priority" "PlatformTicketPriority" NOT NULL DEFAULT 'NORMAL',
  "status" "PlatformTicketStatus" NOT NULL DEFAULT 'OPEN',
  "subject" VARCHAR(160) NOT NULL,
  "message" VARCHAR(5000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformTicket_status_priority_createdAt_idx" ON "PlatformTicket"("status", "priority", "createdAt");
CREATE INDEX "PlatformTicket_tenantId_createdAt_idx" ON "PlatformTicket"("tenantId", "createdAt");
CREATE INDEX "PlatformTicket_createdById_createdAt_idx" ON "PlatformTicket"("createdById", "createdAt");
ALTER TABLE "PlatformTicket" ADD CONSTRAINT "PlatformTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlatformTicket" ADD CONSTRAINT "PlatformTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformTicket" ADD CONSTRAINT "PlatformTicket_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "PlatformStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
