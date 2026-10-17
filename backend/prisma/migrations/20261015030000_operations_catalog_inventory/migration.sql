CREATE TYPE "MeasureUnit" AS ENUM ('EACH', 'GRAM', 'KILOGRAM', 'MILLILITER', 'LITER', 'OUNCE', 'POUND');
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED');
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_RECEIVED', 'WASTE', 'ADJUSTMENT', 'RECIPE_USAGE');

CREATE TABLE "Category" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "name" VARCHAR(100) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_tenantId_name_key" ON "Category"("tenantId", "name");
CREATE INDEX "Category_tenantId_isActive_sortOrder_idx" ON "Category"("tenantId", "isActive", "sortOrder");

CREATE TABLE "Product" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "categoryId" UUID, "name" VARCHAR(160) NOT NULL,
  "description" VARCHAR(1000), "sku" VARCHAR(80), "price" DECIMAL(10,2) NOT NULL,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");
CREATE INDEX "Product_tenantId_categoryId_isAvailable_idx" ON "Product"("tenantId", "categoryId", "isAvailable");
CREATE INDEX "Product_tenantId_name_idx" ON "Product"("tenantId", "name");

CREATE TABLE "Ingredient" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "name" VARCHAR(160) NOT NULL, "unit" "MeasureUnit" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Ingredient_tenantId_name_key" ON "Ingredient"("tenantId", "name");
CREATE INDEX "Ingredient_tenantId_isActive_name_idx" ON "Ingredient"("tenantId", "isActive", "name");

CREATE TABLE "Recipe" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "productId" UUID NOT NULL, "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Recipe_productId_key" ON "Recipe"("productId");
CREATE INDEX "Recipe_tenantId_updatedAt_idx" ON "Recipe"("tenantId", "updatedAt");

CREATE TABLE "RecipeIngredient" (
  "id" UUID NOT NULL, "recipeId" UUID NOT NULL, "ingredientId" UUID NOT NULL, "quantity" DECIMAL(12,3) NOT NULL,
  CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_ingredientId_key" ON "RecipeIngredient"("recipeId", "ingredientId");
CREATE INDEX "RecipeIngredient_ingredientId_idx" ON "RecipeIngredient"("ingredientId");

CREATE TABLE "Supplier" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "name" VARCHAR(160) NOT NULL, "email" VARCHAR(320),
  "phone" VARCHAR(40), "address" VARCHAR(500), "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Supplier_tenantId_name_key" ON "Supplier"("tenantId", "name");
CREATE INDEX "Supplier_tenantId_isActive_name_idx" ON "Supplier"("tenantId", "isActive", "name");

CREATE TABLE "StockLevel" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "branchId" UUID NOT NULL, "ingredientId" UUID NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0, "reorderLevel" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StockLevel_branchId_ingredientId_key" ON "StockLevel"("branchId", "ingredientId");
CREATE INDEX "StockLevel_tenantId_branchId_quantity_idx" ON "StockLevel"("tenantId", "branchId", "quantity");

CREATE TABLE "Purchase" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "branchId" UUID NOT NULL, "supplierId" UUID NOT NULL,
  "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT', "reference" VARCHAR(80), "notes" VARCHAR(1000),
  "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "orderedAt" TIMESTAMP(3), "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Purchase_tenantId_branchId_status_createdAt_idx" ON "Purchase"("tenantId", "branchId", "status", "createdAt");
CREATE INDEX "Purchase_supplierId_createdAt_idx" ON "Purchase"("supplierId", "createdAt");

CREATE TABLE "PurchaseItem" (
  "id" UUID NOT NULL, "purchaseId" UUID NOT NULL, "ingredientId" UUID NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL, "unitCost" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseItem_purchaseId_ingredientId_key" ON "PurchaseItem"("purchaseId", "ingredientId");

CREATE TABLE "StockMovement" (
  "id" UUID NOT NULL, "tenantId" UUID NOT NULL, "branchId" UUID NOT NULL, "ingredientId" UUID NOT NULL,
  "purchaseId" UUID, "type" "StockMovementType" NOT NULL, "quantity" DECIMAL(12,3) NOT NULL,
  "note" VARCHAR(500), "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockMovement_tenantId_branchId_createdAt_idx" ON "StockMovement"("tenantId", "branchId", "createdAt");
CREATE INDEX "StockMovement_ingredientId_createdAt_idx" ON "StockMovement"("ingredientId", "createdAt");

ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
