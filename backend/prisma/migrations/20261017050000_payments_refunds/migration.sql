ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'REFUND_RESTOCK';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'DIGITAL_WALLET';

CREATE TABLE "Payment" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "shiftId" UUID,
  "method" "PaymentMethod" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "tendered" DECIMAL(12,2),
  "changeGiven" DECIMAL(12,2),
  "reference" VARCHAR(120),
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Payment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Payment_tenantId_branchId_createdAt_idx" ON "Payment"("tenantId", "branchId", "createdAt");
CREATE INDEX "Payment_orderId_createdAt_idx" ON "Payment"("orderId", "createdAt");
CREATE INDEX "Payment_shiftId_method_idx" ON "Payment"("shiftId", "method");

CREATE TABLE "Refund" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "shiftId" UUID,
  "amount" DECIMAL(12,2) NOT NULL,
  "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "reason" VARCHAR(500) NOT NULL,
  "restock" BOOLEAN NOT NULL DEFAULT false,
  "method" "PaymentMethod" NOT NULL,
  "createdById" UUID NOT NULL,
  "approvedById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Refund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Refund_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Refund_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Refund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Refund_tenantId_branchId_createdAt_idx" ON "Refund"("tenantId", "branchId", "createdAt");
CREATE INDEX "Refund_orderId_createdAt_idx" ON "Refund"("orderId", "createdAt");

CREATE TABLE "RefundItem" (
  "id" UUID NOT NULL,
  "refundId" UUID NOT NULL,
  "orderItemId" UUID NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT "RefundItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RefundItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RefundItem_refundId_orderItemId_key" ON "RefundItem"("refundId", "orderItemId");
CREATE INDEX "RefundItem_orderItemId_idx" ON "RefundItem"("orderItemId");

INSERT INTO "Payment" ("id", "tenantId", "orderId", "branchId", "shiftId", "method", "amount", "tendered", "changeGiven", "createdById", "createdAt")
SELECT gen_random_uuid(), "tenantId", "id", "branchId", "shiftId", COALESCE("paymentMethod", 'CASH'::"PaymentMethod"), COALESCE("paidAmount", "totalAmount"), "cashReceived", "cashChange", "createdById", COALESCE("completedAt", "createdAt")
FROM "SalesOrder" WHERE "status" = 'COMPLETED' AND "paidAmount" IS NOT NULL;

ALTER TABLE "SalesOrder" ADD COLUMN "taxInclusive" BOOLEAN NOT NULL DEFAULT false;
