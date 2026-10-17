ALTER TYPE "PurchaseStatus" ADD VALUE 'PARTIALLY_RECEIVED';
ALTER TABLE "StockLevel" ADD COLUMN "averageCost" DECIMAL(12,4) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseItem" ADD COLUMN "receivedQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseItem" ADD COLUMN "unit" "MeasureUnit" NOT NULL DEFAULT 'EACH';
ALTER TABLE "PurchaseItem" ADD COLUMN "unitFactor" DECIMAL(12,6) NOT NULL DEFAULT 1;

UPDATE "PurchaseItem" item
SET "receivedQuantity" = item."quantity"
FROM "Purchase" purchase
WHERE purchase."id" = item."purchaseId" AND purchase."status" = 'RECEIVED';

UPDATE "StockLevel" stock
SET "averageCost" = COALESCE(ingredient."unitCost", 0)
FROM "Ingredient" ingredient
WHERE ingredient."id" = stock."ingredientId";
