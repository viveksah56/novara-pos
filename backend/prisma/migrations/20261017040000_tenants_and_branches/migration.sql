ALTER TABLE "Tenant"
  ADD COLUMN "slug" VARCHAR(180),
  ADD COLUMN "legalName" VARCHAR(180),
  ADD COLUMN "phone" VARCHAR(40),
  ADD COLUMN "email" VARCHAR(320),
  ADD COLUMN "address" VARCHAR(500),
  ADD COLUMN "logoUrl" VARCHAR(1000);

UPDATE "Tenant"
SET "slug" = coalesce(nullif(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''), 'business') || '-' || left("id"::text, 8);

ALTER TABLE "Tenant" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

ALTER TABLE "Branch"
  ADD COLUMN "code" VARCHAR(4),
  ADD COLUMN "address" VARCHAR(500),
  ADD COLUMN "phone" VARCHAR(40),
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'NPR',
  ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 13.00,
  ADD COLUMN "taxInclusive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "serviceChargeRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "taxRegistrationNumber" VARCHAR(80),
  ADD COLUMN "receiptHeader" VARCHAR(500),
  ADD COLUMN "receiptFooter" VARCHAR(500),
  ADD COLUMN "businessDayStart" VARCHAR(5) NOT NULL DEFAULT '04:00',
  ADD COLUMN "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireShift" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requirePaymentReference" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shiftVarianceTolerance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "cashierMaxDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

WITH branch_codes AS (
  SELECT "id",
         row_number() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", "id") - 1 AS position
  FROM "Branch"
)
UPDATE "Branch" AS branch
SET "code" = chr(65 + (branch_codes.position / 17576)::integer % 26)
           || chr(65 + (branch_codes.position / 676)::integer % 26)
           || chr(65 + (branch_codes.position / 26)::integer % 26)
           || chr(65 + branch_codes.position::integer % 26)
FROM branch_codes
WHERE branch."id" = branch_codes."id";

ALTER TABLE "Branch" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Branch_tenantId_name_key" ON "Branch"("tenantId", "name");
CREATE UNIQUE INDEX "Branch_tenantId_code_key" ON "Branch"("tenantId", "code");
CREATE INDEX "Branch_tenantId_isActive_createdAt_idx" ON "Branch"("tenantId", "isActive", "createdAt");

ALTER TABLE "AuditLog" ADD COLUMN "metadata" JSONB;

ALTER TABLE "SalesOrder"
  ADD COLUMN "subtotalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "serviceChargeRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "serviceChargeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'NPR';

UPDATE "SalesOrder" SET "subtotalAmount" = "totalAmount";
