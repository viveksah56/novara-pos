CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'OTHER');
CREATE TYPE "KitchenOrderStatus" AS ENUM ('PENDING', 'PREPARING', 'READY');
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

ALTER TABLE "SalesOrder"
  ADD COLUMN "kitchenStatus" "KitchenOrderStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "paymentMethod" "PaymentMethod",
  ADD COLUMN "paidAmount" DECIMAL(12,2),
  ADD COLUMN "cashReceived" DECIMAL(12,2),
  ADD COLUMN "cashChange" DECIMAL(12,2),
  ADD COLUMN "shiftId" UUID,
  ADD COLUMN "clientOrderId" VARCHAR(80);

ALTER TABLE "Ingredient" ADD COLUMN "unitCost" DECIMAL(10,4);

CREATE TABLE "Shift" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
  "openingCash" DECIMAL(12,2) NOT NULL,
  "expectedCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "closingCash" DECIMAL(12,2),
  "cashVariance" DECIMAL(12,2),
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "note" VARCHAR(500),
  CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesOrder_tenantId_clientOrderId_key" ON "SalesOrder"("tenantId", "clientOrderId");
CREATE INDEX "SalesOrder_shiftId_idx" ON "SalesOrder"("shiftId");
CREATE INDEX "Shift_tenantId_branchId_status_openedAt_idx" ON "Shift"("tenantId", "branchId", "status", "openedAt");
CREATE INDEX "Shift_userId_branchId_closedAt_idx" ON "Shift"("userId", "branchId", "closedAt");
CREATE UNIQUE INDEX "Shift_one_open_per_user_branch_key" ON "Shift"("userId", "branchId") WHERE "closedAt" IS NULL;

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
