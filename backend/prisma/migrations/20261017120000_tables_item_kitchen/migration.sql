CREATE TYPE "KitchenItemStatus" AS ENUM ('NEW', 'PREPARING', 'READY', 'SERVED');

CREATE TABLE "DiningTable" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "section" VARCHAR(100),
  "seats" INTEGER NOT NULL DEFAULT 2,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DiningTable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DiningTable_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DiningTable_branchId_name_key" ON "DiningTable"("branchId", "name");
CREATE UNIQUE INDEX "DiningTable_tenantId_branchId_id_key" ON "DiningTable"("tenantId", "branchId", "id");
CREATE INDEX "DiningTable_tenantId_branchId_isActive_section_sortOrder_idx" ON "DiningTable"("tenantId", "branchId", "isActive", "section", "sortOrder");

ALTER TABLE "SalesOrder" ADD COLUMN "tableId" UUID;
ALTER TABLE "SalesOrder" ADD COLUMN "guestCount" INTEGER;
ALTER TABLE "SalesOrder" ADD COLUMN "billRequestedAt" TIMESTAMP(3);
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "SalesOrder_tenantId_branchId_tableId_status_idx" ON "SalesOrder"("tenantId", "branchId", "tableId", "status");
CREATE UNIQUE INDEX "SalesOrder_one_open_order_per_table_key" ON "SalesOrder"("tableId") WHERE "tableId" IS NOT NULL AND "status" = 'OPEN';

ALTER TABLE "SalesOrderItem" ADD COLUMN "note" VARCHAR(200);
ALTER TABLE "SalesOrderItem" ADD COLUMN "kitchenStatus" "KitchenItemStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "SalesOrderItem" ADD COLUMN "sentToKitchenAt" TIMESTAMP(3);
ALTER TABLE "SalesOrderItem" ADD COLUMN "preparingAt" TIMESTAMP(3);
ALTER TABLE "SalesOrderItem" ADD COLUMN "readyAt" TIMESTAMP(3);
ALTER TABLE "SalesOrderItem" ADD COLUMN "servedAt" TIMESTAMP(3);
ALTER TABLE "SalesOrderItem" ADD COLUMN "station" VARCHAR(100);
CREATE INDEX "SalesOrderItem_sentToKitchenAt_kitchenStatus_idx" ON "SalesOrderItem"("sentToKitchenAt", "kitchenStatus");

-- Preserve the old order-level kitchen queue for open tickets during rollout.
UPDATE "SalesOrderItem" AS item
SET "sentToKitchenAt" = order_row."createdAt",
    "kitchenStatus" = CASE order_row."kitchenStatus"::text
      WHEN 'PREPARING' THEN 'PREPARING'::"KitchenItemStatus"
      WHEN 'READY' THEN 'READY'::"KitchenItemStatus"
      ELSE 'NEW'::"KitchenItemStatus"
    END
FROM "SalesOrder" AS order_row
WHERE item."orderId" = order_row."id"
  AND order_row."status" = 'OPEN';
ALTER TABLE "SalesOrder" ADD COLUMN "offlineOrigin" BOOLEAN NOT NULL DEFAULT false;
