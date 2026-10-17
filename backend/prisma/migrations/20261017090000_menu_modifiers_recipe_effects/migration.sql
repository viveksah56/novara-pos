DROP INDEX IF EXISTS "SalesOrderItem_orderId_productId_key";
ALTER TABLE "SalesOrderItem" ADD COLUMN "unitCost" DECIMAL(12,4);

CREATE TABLE "ModifierGroup" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "minSelect" INTEGER NOT NULL DEFAULT 0,
  "maxSelect" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModifierGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductModifierGroup" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductModifierGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModifierOption" (
  "id" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "priceDelta" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ModifierOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModifierOptionRecipeItem" (
  "id" UUID NOT NULL,
  "optionId" UUID NOT NULL,
  "ingredientId" UUID NOT NULL,
  "quantityDelta" DECIMAL(12,3) NOT NULL,
  CONSTRAINT "ModifierOptionRecipeItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesOrderItemModifier" (
  "id" UUID NOT NULL,
  "orderItemId" UUID NOT NULL,
  "optionId" UUID,
  "groupName" VARCHAR(120) NOT NULL,
  "optionName" VARCHAR(120) NOT NULL,
  "priceDelta" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "SalesOrderItemModifier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesOrderItemModifierEffect" (
  "id" UUID NOT NULL,
  "orderItemModifierId" UUID NOT NULL,
  "ingredientId" UUID NOT NULL,
  "ingredientName" VARCHAR(160) NOT NULL,
  "quantityDelta" DECIMAL(12,3) NOT NULL,
  CONSTRAINT "SalesOrderItemModifierEffect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModifierGroup_tenantId_name_key" ON "ModifierGroup"("tenantId", "name");
CREATE INDEX "ModifierGroup_tenantId_isActive_sortOrder_idx" ON "ModifierGroup"("tenantId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "ProductModifierGroup_productId_groupId_key" ON "ProductModifierGroup"("productId", "groupId");
CREATE INDEX "ProductModifierGroup_groupId_sortOrder_idx" ON "ProductModifierGroup"("groupId", "sortOrder");
CREATE UNIQUE INDEX "ModifierOption_groupId_name_key" ON "ModifierOption"("groupId", "name");
CREATE INDEX "ModifierOption_groupId_isActive_sortOrder_idx" ON "ModifierOption"("groupId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "ModifierOptionRecipeItem_optionId_ingredientId_key" ON "ModifierOptionRecipeItem"("optionId", "ingredientId");
CREATE INDEX "ModifierOptionRecipeItem_ingredientId_idx" ON "ModifierOptionRecipeItem"("ingredientId");
CREATE INDEX "SalesOrderItem_orderId_productId_idx" ON "SalesOrderItem"("orderId", "productId");
CREATE INDEX "SalesOrderItemModifier_orderItemId_idx" ON "SalesOrderItemModifier"("orderItemId");
CREATE INDEX "SalesOrderItemModifierEffect_orderItemModifierId_idx" ON "SalesOrderItemModifierEffect"("orderItemModifierId");
CREATE INDEX "SalesOrderItemModifierEffect_ingredientId_idx" ON "SalesOrderItemModifierEffect"("ingredientId");

ALTER TABLE "ModifierGroup" ADD CONSTRAINT "ModifierGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductModifierGroup" ADD CONSTRAINT "ProductModifierGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductModifierGroup" ADD CONSTRAINT "ProductModifierGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModifierOption" ADD CONSTRAINT "ModifierOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModifierOptionRecipeItem" ADD CONSTRAINT "ModifierOptionRecipeItem_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ModifierOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModifierOptionRecipeItem" ADD CONSTRAINT "ModifierOptionRecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrderItemModifier" ADD CONSTRAINT "SalesOrderItemModifier_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrderItemModifier" ADD CONSTRAINT "SalesOrderItemModifier_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ModifierOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrderItemModifierEffect" ADD CONSTRAINT "SalesOrderItemModifierEffect_orderItemModifierId_fkey" FOREIGN KEY ("orderItemModifierId") REFERENCES "SalesOrderItemModifier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrderItemModifierEffect" ADD CONSTRAINT "SalesOrderItemModifierEffect_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
