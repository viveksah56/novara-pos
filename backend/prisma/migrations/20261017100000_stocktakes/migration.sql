CREATE TYPE "StocktakeStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED');
ALTER TYPE "StockMovementType" ADD VALUE 'STOCKTAKE';
ALTER TABLE "StockMovement" ADD COLUMN "stocktakeId" UUID;
CREATE INDEX "StockMovement_stocktakeId_idx" ON "StockMovement"("stocktakeId");

CREATE TABLE "Stocktake" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "status" "StocktakeStatus" NOT NULL DEFAULT 'DRAFT',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdById" UUID NOT NULL,
  "approvedById" UUID,
  "note" VARCHAR(500),
  CONSTRAINT "Stocktake_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StocktakeLine" (
  "id" UUID NOT NULL,
  "stocktakeId" UUID NOT NULL,
  "ingredientId" UUID NOT NULL,
  "countedQuantity" DECIMAL(12,3) NOT NULL,
  "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedAtCount" DECIMAL(12,3),
  "variance" DECIMAL(12,3),
  "unitCost" DECIMAL(10,4),
  CONSTRAINT "StocktakeLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StocktakeLine_stocktakeId_ingredientId_key" ON "StocktakeLine"("stocktakeId", "ingredientId");
CREATE INDEX "StocktakeLine_ingredientId_countedAt_idx" ON "StocktakeLine"("ingredientId", "countedAt");
CREATE INDEX "Stocktake_tenantId_branchId_status_startedAt_idx" ON "Stocktake"("tenantId", "branchId", "status", "startedAt");

ALTER TABLE "Stocktake" ADD CONSTRAINT "Stocktake_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stocktake" ADD CONSTRAINT "Stocktake_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Stocktake" ADD CONSTRAINT "Stocktake_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Stocktake" ADD CONSTRAINT "Stocktake_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StocktakeLine" ADD CONSTRAINT "StocktakeLine_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "Stocktake"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StocktakeLine" ADD CONSTRAINT "StocktakeLine_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "Stocktake"("id") ON DELETE SET NULL ON UPDATE CASCADE;
