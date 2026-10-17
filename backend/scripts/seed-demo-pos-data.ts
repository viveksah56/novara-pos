import { env } from "@config/env.js";
import { prisma } from "@lib/prisma.js";
import { userSeedData } from "../prisma/data/user-seed-data.js";

const demoTenantId = "00000000-0000-4000-8000-000000000101";
const branchIds = [
  "00000000-0000-4000-8000-000000000102",
  "00000000-0000-4000-8000-000000000103",
] as const;
const seededUsers = Object.fromEntries(userSeedData.map((user) => [user.role, user.id]));
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const daysAgo = (days: number, hours = 12) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  value.setHours(hours, 0, 0, 0);
  return value;
};

const planRows = [
  { id: id(1001), name: "Demo Starter", description: "A practical starting point for one cafe.", priceMonthly: 0, trialDays: 14, maxBranches: 1, maxStaff: 8 },
  { id: id(1002), name: "Demo Growth", description: "For teams running multiple service locations.", priceMonthly: 4900, trialDays: 14, maxBranches: 5, maxStaff: 40 },
  { id: id(1003), name: "Demo Group", description: "Flexible operations for growing hospitality groups.", priceMonthly: 12900, trialDays: 14, maxBranches: null, maxStaff: null },
] as const;

const categories = ["Coffee", "Tea & Matcha", "Bakery", "Kitchen", "Retail"] as const;
const ingredientRows = [
  { name: "House espresso beans", unit: "GRAM", unitCost: 0.085, reorderLevel: 1500, opening: 1200, purchase: 12000 },
  { name: "Whole milk", unit: "MILLILITER", unitCost: 0.12, reorderLevel: 8000, opening: 4500, purchase: 42000 },
  { name: "Oat milk", unit: "MILLILITER", unitCost: 0.19, reorderLevel: 3500, opening: 1600, purchase: 18000 },
  { name: "Chocolate sauce", unit: "MILLILITER", unitCost: 0.24, reorderLevel: 1200, opening: 1000, purchase: 8000 },
  { name: "Ceremonial matcha", unit: "GRAM", unitCost: 1.8, reorderLevel: 250, opening: 250, purchase: 1800 },
  { name: "Assam tea", unit: "GRAM", unitCost: 0.22, reorderLevel: 500, opening: 400, purchase: 3600 },
  { name: "Butter croissant", unit: "EACH", unitCost: 65, reorderLevel: 12, opening: 15, purchase: 120 },
  { name: "Chicken sandwich", unit: "EACH", unitCost: 145, reorderLevel: 10, opening: 12, purchase: 100 },
  { name: "Cheesecake slice", unit: "EACH", unitCost: 110, reorderLevel: 10, opening: 12, purchase: 90 },
  { name: "Bottled water", unit: "EACH", unitCost: 18, reorderLevel: 24, opening: 24, purchase: 240 },
] as const;

const productRows = [
  { name: "Espresso", sku: "COF-ESP", category: 0, price: 180, recipe: [[0, 18]] },
  { name: "Americano", sku: "COF-AMR", category: 0, price: 220, recipe: [[0, 18]] },
  { name: "Cappuccino", sku: "COF-CAP", category: 0, price: 280, recipe: [[0, 18], [1, 120]] },
  { name: "Cafe Latte", sku: "COF-LAT", category: 0, price: 300, recipe: [[0, 18], [1, 200]] },
  { name: "Mocha", sku: "COF-MOC", category: 0, price: 340, recipe: [[0, 18], [1, 200], [3, 20]] },
  { name: "Iced Latte", sku: "COF-ICE", category: 0, price: 320, recipe: [[0, 18], [1, 200]] },
  { name: "Matcha Latte", sku: "TEA-MAT", category: 1, price: 360, recipe: [[4, 6], [1, 200]] },
  { name: "Masala Chai", sku: "TEA-CHI", category: 1, price: 240, recipe: [[5, 8], [1, 180]] },
  { name: "Butter Croissant", sku: "BAK-CRO", category: 2, price: 190, recipe: [[6, 1]] },
  { name: "Chicken Sandwich", sku: "KIT-SAN", category: 3, price: 420, recipe: [[7, 1]] },
  { name: "New York Cheesecake", sku: "BAK-CHK", category: 2, price: 360, recipe: [[8, 1]] },
  { name: "Mineral Water", sku: "DRK-WAT", category: 3, price: 80, recipe: [[9, 1]] },
  { name: "Single Origin Beans · 250 g", sku: "RTL-BEAN-250", category: 4, price: 1250, recipe: [[0, 250]] },
] as const;

const suppliers = [
  { name: "Himalayan Coffee Roasters", email: "orders@himalayanroast.example", phone: "+977-1-555-0142", address: "Lalitpur, Nepal" },
  { name: "Valley Dairy Cooperative", email: "supply@valleydairy.example", phone: "+977-1-555-0188", address: "Bhaktapur, Nepal" },
  { name: "Kathmandu Pantry & Bakehouse", email: "wholesale@ktmpantry.example", phone: "+977-1-555-0116", address: "Kathmandu, Nepal" },
] as const;

async function seedDemoPosData(): Promise<void> {
  const databaseHost = new URL(env.DATABASE_URL).hostname;
  if (env.isProd || !["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
    throw new Error("Sample POS data can only be written to a local development database.");
  }

  const knownUsers = await prisma.user.findMany({ where: { id: { in: Object.values(seededUsers) } }, select: { id: true } });
  if (knownUsers.length !== userSeedData.length) {
    throw new Error("Demo role accounts are missing. Run `npm run db:seed:demo` first.");
  }

  await prisma.$transaction(async (tx) => {
    const starterPlan = planRows[0];
    for (const plan of planRows) {
      await tx.subscriptionPlan.upsert({ where: { id: plan.id }, create: { ...plan, currency: "NPR", isActive: true }, update: { ...plan, currency: "NPR", isActive: true } });
    }
    await tx.tenant.upsert({
      where: { id: demoTenantId },
      create: { id: demoTenantId, name: "Himalayan Brew Demo", slug: "himalayan-brew-demo", currency: "NPR", planId: starterPlan.id },
      update: { name: "Himalayan Brew Demo", slug: "himalayan-brew-demo", currency: "NPR", status: "ACTIVE", planId: starterPlan.id },
    });
    const subscriptionId = id(1010);
    await tx.subscription.upsert({
      where: { tenantId: demoTenantId },
      create: { id: subscriptionId, tenantId: demoTenantId, planId: starterPlan.id, status: "TRIALING", currentPeriodStart: daysAgo(5), currentPeriodEnd: daysAgo(-9), trialEndsAt: daysAgo(-9) },
      update: { planId: starterPlan.id, status: "TRIALING", currentPeriodStart: daysAgo(5), currentPeriodEnd: daysAgo(-9), trialEndsAt: daysAgo(-9), canceledAt: null },
    });

    const branchRows = [
      { id: branchIds[0], name: "Demo Branch", code: "DE", address: "Thamel, Kathmandu", phone: "+977-1-555-0101" },
      { id: branchIds[1], name: "Patan Riverside", code: "PT", address: "Patan, Lalitpur", phone: "+977-1-555-0102" },
    ] as const;
    for (const branch of branchRows) {
      await tx.branch.upsert({
        where: { id: branch.id },
        create: { ...branch, tenantId: demoTenantId, timezone: "Asia/Kathmandu", currency: "NPR", taxRate: 13, serviceChargeRate: 5, businessDayStart: "04:00", requireShift: true, requirePaymentReference: false },
        update: { ...branch, tenantId: demoTenantId, timezone: "Asia/Kathmandu", currency: "NPR", taxRate: 13, serviceChargeRate: 5, businessDayStart: "04:00", requireShift: true, requirePaymentReference: false, isActive: true },
      });
    }

    const scopedRoles = ["MANAGER", "CASHIER", "WAITER", "KITCHEN_STAFF", "INVENTORY_MANAGER"] as const;
    for (const role of scopedRoles) {
      const membership = await tx.membership.findUnique({ where: { tenantId_userId: { tenantId: demoTenantId, userId: seededUsers[role] } }, select: { id: true } });
      if (!membership) throw new Error(`Missing demo ${role} membership. Run the account seed first.`);
      for (const branchId of branchIds) {
        await tx.branchAssignment.upsert({ where: { membershipId_branchId: { membershipId: membership.id, branchId } }, create: { tenantId: demoTenantId, membershipId: membership.id, branchId }, update: { tenantId: demoTenantId } });
      }
    }
    const supportStaff = await tx.platformStaff.findUnique({ where: { userId: seededUsers.SUPPORT_AGENT }, select: { id: true } });
    if (!supportStaff) throw new Error("Missing demo support-agent account. Run `npm run db:seed:demo` first.");

    const categoryIds = categories.map((_, index) => id(1101 + index));
    for (const [index, name] of categories.entries()) {
      await tx.category.upsert({ where: { id: categoryIds[index] }, create: { id: categoryIds[index], tenantId: demoTenantId, name, sortOrder: index }, update: { tenantId: demoTenantId, name, sortOrder: index, isActive: true } });
    }
    const ingredientIds = ingredientRows.map((_, index) => id(1201 + index));
    for (const [index, ingredient] of ingredientRows.entries()) {
      await tx.ingredient.upsert({ where: { id: ingredientIds[index] }, create: { id: ingredientIds[index], tenantId: demoTenantId, name: ingredient.name, unit: ingredient.unit, unitCost: ingredient.unitCost }, update: { tenantId: demoTenantId, name: ingredient.name, unit: ingredient.unit, unitCost: ingredient.unitCost, isActive: true } });
    }
    const productIds = productRows.map((_, index) => id(1301 + index));
    for (const [index, product] of productRows.entries()) {
      await tx.product.upsert({
        where: { id: productIds[index] },
        create: { id: productIds[index], tenantId: demoTenantId, categoryId: categoryIds[product.category], name: product.name, description: `Freshly prepared ${product.name.toLowerCase()} from Himalayan Brew.`, sku: product.sku, price: product.price, isAvailable: true },
        update: { tenantId: demoTenantId, categoryId: categoryIds[product.category], name: product.name, description: `Freshly prepared ${product.name.toLowerCase()} from Himalayan Brew.`, sku: product.sku, price: product.price, isAvailable: true },
      });
    }
    const recipeIds = productRows.map((_, index) => id(1401 + index));
    for (const [index, product] of productRows.entries()) {
      await tx.recipe.upsert({ where: { productId: productIds[index] }, create: { id: recipeIds[index], tenantId: demoTenantId, productId: productIds[index], notes: "Standard single-serve recipe; quantities use the ingredient base unit." }, update: { tenantId: demoTenantId, notes: "Standard single-serve recipe; quantities use the ingredient base unit." } });
      const recipe = await tx.recipe.findUniqueOrThrow({ where: { productId: productIds[index] }, select: { id: true } });
      for (const [lineIndex, [ingredientIndex, quantity]] of product.recipe.entries()) {
        const lineId = id(1501 + index * 20 + lineIndex);
        await tx.recipeIngredient.upsert({ where: { recipeId_ingredientId: { recipeId: recipe.id, ingredientId: ingredientIds[ingredientIndex] } }, create: { id: lineId, recipeId: recipe.id, ingredientId: ingredientIds[ingredientIndex], quantity }, update: { quantity } });
      }
    }

    const milkGroupId = id(1601);
    await tx.modifierGroup.upsert({ where: { id: milkGroupId }, create: { id: milkGroupId, tenantId: demoTenantId, name: "Milk choice", minSelect: 0, maxSelect: 1, sortOrder: 1 }, update: { tenantId: demoTenantId, name: "Milk choice", minSelect: 0, maxSelect: 1, sortOrder: 1, isActive: true } });
    const milkOptions = [
      { id: id(1602), name: "Whole milk", priceDelta: 0, isDefault: true },
      { id: id(1603), name: "Oat milk", priceDelta: 75, isDefault: false },
    ] as const;
    for (const [index, option] of milkOptions.entries()) {
      await tx.modifierOption.upsert({ where: { id: option.id }, create: { ...option, groupId: milkGroupId, sortOrder: index }, update: { ...option, groupId: milkGroupId, sortOrder: index, isActive: true } });
    }
    for (const productIndex of [3, 5]) {
      const productId = productIds[productIndex];
      await tx.productModifierGroup.upsert({ where: { productId_groupId: { productId, groupId: milkGroupId } }, create: { id: id(1610 + productIndex), productId, groupId: milkGroupId, sortOrder: 1 }, update: { sortOrder: 1 } });
    }
    for (const [effectIndex, [ingredientIndex, quantityDelta]] of [[1, -200], [2, 200]].entries()) {
      await tx.modifierOptionRecipeItem.upsert({ where: { optionId_ingredientId: { optionId: milkOptions[1].id, ingredientId: ingredientIds[ingredientIndex] } }, create: { id: id(1620 + effectIndex), optionId: milkOptions[1].id, ingredientId: ingredientIds[ingredientIndex], quantityDelta }, update: { quantityDelta } });
    }

    const supplierIds = suppliers.map((_, index) => id(1701 + index));
    for (const [index, supplier] of suppliers.entries()) {
      await tx.supplier.upsert({ where: { id: supplierIds[index] }, create: { id: supplierIds[index], tenantId: demoTenantId, ...supplier }, update: { tenantId: demoTenantId, ...supplier, isActive: true } });
    }

    const tableIds = branchIds.flatMap((branchId, branchIndex) => [0, 1, 2, 3].map((tableIndex) => id(1801 + branchIndex * 10 + tableIndex)));
    for (const [index, tableId] of tableIds.entries()) {
      const branchIndex = Math.floor(index / 4);
      const tableIndex = index % 4;
      const name = `Table ${tableIndex + 1}`;
      await tx.diningTable.upsert({ where: { id: tableId }, create: { id: tableId, tenantId: demoTenantId, branchId: branchIds[branchIndex], name, section: tableIndex < 2 ? "Window" : "Garden", seats: tableIndex < 2 ? 2 : 4, sortOrder: tableIndex }, update: { tenantId: demoTenantId, branchId: branchIds[branchIndex], name, section: tableIndex < 2 ? "Window" : "Garden", seats: tableIndex < 2 ? 2 : 4, sortOrder: tableIndex, isActive: true } });
    }

    const expenseCategoryNames = ["Rent", "Utilities", "Team meals", "Cleaning supplies", "Local marketing"] as const;
    const expenseCategoryIds = expenseCategoryNames.map((_, index) => id(1901 + index));
    for (const [index, name] of expenseCategoryNames.entries()) {
      await tx.expenseCategory.upsert({ where: { id: expenseCategoryIds[index] }, create: { id: expenseCategoryIds[index], tenantId: demoTenantId, name }, update: { tenantId: demoTenantId, name, isActive: true } });
    }

    const shifts = [
      { id: id(2001), branchId: branchIds[0], userId: seededUsers.CASHIER, openedAt: daysAgo(14, 7), closedAt: daysAgo(14, 15), openingCash: 3000, status: "CLOSED" as const },
      { id: id(2002), branchId: branchIds[0], userId: seededUsers.CASHIER, openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), closedAt: null, openingCash: 3000, status: "OPEN" as const },
      { id: id(2003), branchId: branchIds[1], userId: seededUsers.MANAGER, openedAt: daysAgo(12, 7), closedAt: daysAgo(12, 15), openingCash: 2500, status: "CLOSED" as const },
      { id: id(2004), branchId: branchIds[1], userId: seededUsers.MANAGER, openedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), closedAt: null, openingCash: 2500, status: "OPEN" as const },
    ];
    for (const shift of shifts) {
      await tx.shift.upsert({ where: { id: shift.id }, create: { ...shift, tenantId: demoTenantId, expectedCash: shift.openingCash }, update: { ...shift, expectedCash: shift.openingCash, closingCash: null, cashVariance: null, note: "Seeded sample register shift" } });
    }

    const purchaseBaseIds = [id(2101), id(2102)];
    for (const [branchIndex, purchaseId] of purchaseBaseIds.entries()) {
      const branchId = branchIds[branchIndex];
      const supplierId = supplierIds[branchIndex];
      const ordered = branchIndex === 1;
      const purchaseItems = ingredientRows.map((ingredient, ingredientIndex) => ({
        id: id(2201 + branchIndex * 20 + ingredientIndex),
        ingredientId: ingredientIds[ingredientIndex],
        quantity: ordered ? Math.ceil(ingredient.purchase * 0.25) : ingredient.purchase,
        receivedQuantity: ordered ? 0 : ingredient.purchase,
        unit: ingredient.unit,
        unitFactor: 1,
        unitCost: ingredient.unitCost,
      }));
      const totalAmount = round(purchaseItems.reduce((sum, item) => sum + item.quantity * round(item.unitCost), 0));
      await tx.purchase.upsert({ where: { id: purchaseId }, create: { id: purchaseId, tenantId: demoTenantId, branchId, supplierId, status: ordered ? "ORDERED" : "RECEIVED", reference: `PO-DEMO-${branchIndex + 1}-001`, notes: ordered ? "Next weekly delivery" : "Weekly opening stock delivery", totalAmount, orderedAt: daysAgo(ordered ? 1 : 20), receivedAt: ordered ? null : daysAgo(19) }, update: { tenantId: demoTenantId, branchId, supplierId, status: ordered ? "ORDERED" : "RECEIVED", reference: `PO-DEMO-${branchIndex + 1}-001`, notes: ordered ? "Next weekly delivery" : "Weekly opening stock delivery", totalAmount, orderedAt: daysAgo(ordered ? 1 : 20), receivedAt: ordered ? null : daysAgo(19) } });
      for (const item of purchaseItems) {
        await tx.purchaseItem.upsert({ where: { id: item.id }, create: { purchaseId, ...item }, update: { purchaseId, ...item } });
      }
    }

    const stockMovementRows: Array<{ id: string; branchId: string; ingredientIndex: number; quantity: number; type: "ADJUSTMENT" | "PURCHASE_RECEIVED" | "RECIPE_USAGE" | "REFUND_RESTOCK" | "WASTE"; purchaseId?: string; salesOrderId?: string; note: string; createdAt: Date }> = [];
    const openingByBranch = branchIds.map(() => ingredientRows.map((ingredient) => ingredient.opening));
    for (const [branchIndex, branchId] of branchIds.entries()) {
      ingredientRows.forEach((ingredient, ingredientIndex) => stockMovementRows.push({ id: id(3001 + branchIndex * 20 + ingredientIndex), branchId, ingredientIndex, quantity: ingredient.opening, type: "ADJUSTMENT", note: "Opening demo stock", createdAt: daysAgo(35) }));
    }
    ingredientRows.forEach((ingredient, ingredientIndex) => stockMovementRows.push({ id: id(3051 + ingredientIndex), branchId: branchIds[0], ingredientIndex, quantity: ingredient.purchase, type: "PURCHASE_RECEIVED", purchaseId: purchaseBaseIds[0], note: "Opening supplier delivery", createdAt: daysAgo(19) }));

    const runningStock = openingByBranch.map((values) => [...values]);
    ingredientRows.forEach((ingredient, index) => { runningStock[0][index] += ingredient.purchase; });
    const cashByShift = new Map<string, number>(shifts.map((shift) => [shift.id, 0]));
    const productConsumption = (productIndex: number, quantity: number, oatMilk: boolean) => {
      const usage = new Map<number, number>();
      for (const [ingredientIndex, amount] of productRows[productIndex].recipe) usage.set(ingredientIndex, (usage.get(ingredientIndex) ?? 0) + amount * quantity);
      if (oatMilk) {
        usage.set(1, (usage.get(1) ?? 0) - 200 * quantity);
        usage.set(2, (usage.get(2) ?? 0) + 200 * quantity);
      }
      return usage;
    };

    const saleOrderIds: string[] = [];
    const refundOrderIndex = 6;
    let refundContext: { orderId: string; itemId: string; branchId: string; actorId: string; shiftId: string; quantity: number; amount: number; taxAmount: number; serviceAmount: number; itemAmount: number; ingredientUsage: Map<number, number>; createdAt: Date } | undefined;
    for (let orderIndex = 0; orderIndex < 30; orderIndex += 1) {
      const orderId = id(4001 + orderIndex);
      saleOrderIds.push(orderId);
      const branchIndex = orderIndex % 2;
      const branchId = branchIds[branchIndex];
      const isOpen = orderIndex >= 28;
      const orderCreatedAt = isOpen ? new Date(Date.now() - (orderIndex === 28 ? 25 : 50) * 60_000) : orderIndex < 2 ? new Date(Date.now() - (orderIndex + 1) * 60 * 60_000) : daysAgo(orderIndex - 1, 8 + orderIndex % 10);
      const actorId = branchIndex === 0 ? (orderIndex % 3 === 0 ? seededUsers.WAITER : seededUsers.CASHIER) : seededUsers.MANAGER;
      let shift = branchIndex === 0 ? shifts[1] : shifts[3];
      if (orderIndex >= 2 && !isOpen) {
        const shiftDate = daysAgo(orderIndex - 1, 0);
        shift = {
          id: id(10_000 + orderIndex),
          branchId,
          userId: branchIndex === 0 ? seededUsers.CASHIER : seededUsers.MANAGER,
          openedAt: new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 7),
          closedAt: new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate(), 22),
          openingCash: branchIndex === 0 ? 3000 : 2500,
          status: "CLOSED",
        };
        await tx.shift.upsert({
          where: { id: shift.id },
          create: { ...shift, tenantId: demoTenantId, expectedCash: shift.openingCash, closingCash: shift.openingCash, cashVariance: 0 },
          update: { ...shift, tenantId: demoTenantId, expectedCash: shift.openingCash, closingCash: shift.openingCash, cashVariance: 0, note: "Seeded historical register shift" },
        });
        shifts.push(shift);
        cashByShift.set(shift.id, 0);
      }
      const tableId = isOpen ? tableIds[branchIndex * 4 + (orderIndex - 28)] : undefined;
      const lines = Array.from({ length: isOpen ? 2 : 2 + orderIndex % 3 }, (_, lineIndex) => ({
        productIndex: (orderIndex * 3 + lineIndex * 2) % productRows.length,
        quantity: isOpen ? 1 : 1 + ((orderIndex + lineIndex) % 2),
      }));
      const lineRows = lines.map((line, lineIndex) => {
        const product = productRows[line.productIndex];
        const oatMilk = !isOpen && [3, 5].includes(line.productIndex) && orderIndex % 4 === 0;
        const modifierDelta = oatMilk ? 75 : 0;
        const unitPrice = product.price + modifierDelta;
        const lineTotal = round(unitPrice * line.quantity);
        const usage = productConsumption(line.productIndex, line.quantity, oatMilk);
        const unitCost = [...usage.entries()].reduce((sum, [ingredientIndex, quantity]) => sum + Math.max(0, quantity / line.quantity) * ingredientRows[ingredientIndex].unitCost, 0);
        return { lineIndex, productIndex: line.productIndex, quantity: line.quantity, oatMilk, unitPrice, lineTotal, unitCost: round(unitCost), usage };
      });
      const subtotalAmount = round(lineRows.reduce((sum, line) => sum + line.lineTotal, 0));
      const serviceChargeAmount = round(subtotalAmount * 0.05);
      const taxAmount = round((subtotalAmount + serviceChargeAmount) * 0.13);
      const totalAmount = round(subtotalAmount + serviceChargeAmount + taxAmount);
      const orderStatus = isOpen ? "OPEN" : orderIndex === refundOrderIndex ? "PARTIALLY_REFUNDED" : "COMPLETED";
      const itemUsage = new Map<number, number>();
      for (const line of lineRows) for (const [ingredientIndex, quantity] of line.usage) itemUsage.set(ingredientIndex, (itemUsage.get(ingredientIndex) ?? 0) + quantity);
      const sentAt = orderCreatedAt;
      await tx.salesOrder.upsert({
        where: { id: orderId },
        create: { id: orderId, tenantId: demoTenantId, branchId, tableId, guestCount: tableId ? 2 + orderIndex % 4 : null, billRequestedAt: isOpen && orderIndex === 28 ? new Date() : null, createdById: actorId, status: orderStatus, subtotalAmount, taxRate: 13, taxAmount, taxInclusive: false, serviceChargeRate: 5, serviceChargeAmount, currency: "NPR", totalAmount, completedAt: isOpen ? null : orderCreatedAt, kitchenStatus: isOpen ? (orderIndex === 28 ? "PREPARING" : "PENDING") : "READY", paymentMethod: isOpen ? null : orderIndex % 5 === 0 ? null : "CASH", paidAmount: isOpen ? null : totalAmount, cashReceived: isOpen ? null : round(totalAmount * (orderIndex % 5 === 0 ? 0.4 : 1) + 20), cashChange: isOpen ? null : 20, shiftId: isOpen ? null : shift.id, clientOrderId: `demo-checkout-${String(orderIndex + 1).padStart(3, "0")}`, createdAt: orderCreatedAt },
        update: { tenantId: demoTenantId, branchId, tableId, guestCount: tableId ? 2 + orderIndex % 4 : null, billRequestedAt: isOpen && orderIndex === 28 ? new Date() : null, createdById: actorId, status: orderStatus, subtotalAmount, taxRate: 13, taxAmount, taxInclusive: false, serviceChargeRate: 5, serviceChargeAmount, currency: "NPR", totalAmount, completedAt: isOpen ? null : orderCreatedAt, kitchenStatus: isOpen ? (orderIndex === 28 ? "PREPARING" : "PENDING") : "READY", paymentMethod: isOpen ? null : orderIndex % 5 === 0 ? null : "CASH", paidAmount: isOpen ? null : totalAmount, cashReceived: isOpen ? null : round(totalAmount * (orderIndex % 5 === 0 ? 0.4 : 1) + 20), cashChange: isOpen ? null : 20, shiftId: isOpen ? null : shift.id, clientOrderId: `demo-checkout-${String(orderIndex + 1).padStart(3, "0")}`, createdAt: orderCreatedAt },
      });

      for (const line of lineRows) {
        const itemId = id(5001 + orderIndex * 10 + line.lineIndex);
        const servedAt = isOpen ? null : new Date(orderCreatedAt.getTime() + 8 * 60_000);
        await tx.salesOrderItem.upsert({
          where: { id: itemId },
          create: { id: itemId, orderId, productId: productIds[line.productIndex], quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal, unitCost: line.unitCost, note: line.lineIndex === 0 && orderIndex % 5 === 0 ? "Serve extra hot" : null, kitchenStatus: isOpen ? (orderIndex === 28 ? "PREPARING" : "NEW") : "SERVED", sentToKitchenAt: !isOpen || orderIndex === 28 ? sentAt : null, preparingAt: !isOpen || orderIndex === 28 ? new Date(sentAt.getTime() + 2 * 60_000) : null, readyAt: servedAt, servedAt },
          update: { orderId, productId: productIds[line.productIndex], quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal, unitCost: line.unitCost, note: line.lineIndex === 0 && orderIndex % 5 === 0 ? "Serve extra hot" : null, kitchenStatus: isOpen ? (orderIndex === 28 ? "PREPARING" : "NEW") : "SERVED", sentToKitchenAt: !isOpen || orderIndex === 28 ? sentAt : null, preparingAt: !isOpen || orderIndex === 28 ? new Date(sentAt.getTime() + 2 * 60_000) : null, readyAt: servedAt, servedAt },
        });
        if (line.oatMilk) {
          const modifierId = id(6001 + orderIndex * 10 + line.lineIndex);
          await tx.salesOrderItemModifier.upsert({ where: { id: modifierId }, create: { id: modifierId, orderItemId: itemId, optionId: milkOptions[1].id, groupName: "Milk choice", optionName: "Oat milk", priceDelta: 75 }, update: { orderItemId: itemId, optionId: milkOptions[1].id, groupName: "Milk choice", optionName: "Oat milk", priceDelta: 75 } });
          for (const [effectIndex, [ingredientIndex, quantityDelta]] of [[1, -200 * line.quantity], [2, 200 * line.quantity]].entries()) {
            const effectId = id(6301 + orderIndex * 10 + line.lineIndex * 2 + effectIndex);
            await tx.salesOrderItemModifierEffect.upsert({ where: { id: effectId }, create: { id: effectId, orderItemModifierId: modifierId, ingredientId: ingredientIds[ingredientIndex], ingredientName: ingredientRows[ingredientIndex].name, quantityDelta }, update: { orderItemModifierId: modifierId, ingredientId: ingredientIds[ingredientIndex], ingredientName: ingredientRows[ingredientIndex].name, quantityDelta } });
          }
        }
      }

      if (!isOpen) {
        const split = orderIndex % 5 === 0;
        const cashAmount = split ? round(totalAmount * 0.4) : totalAmount;
        const payments = split ? [{ amount: cashAmount, method: "CASH" as const }, { amount: round(totalAmount - cashAmount), method: "CARD" as const }] : [{ amount: totalAmount, method: "CASH" as const }];
        let paymentIndex = 0;
        for (const payment of payments) {
          const paymentId = id(7001 + orderIndex * 2 + paymentIndex);
          const tendered = payment.method === "CASH" ? round(payment.amount + 20) : null;
          await tx.payment.upsert({ where: { id: paymentId }, create: { id: paymentId, tenantId: demoTenantId, orderId, branchId, shiftId: shift.id, method: payment.method, amount: payment.amount, tendered, changeGiven: payment.method === "CASH" ? 20 : null, reference: payment.method === "CARD" ? `DEMO-${String(orderIndex + 1).padStart(4, "0")}` : null, createdById: shift.userId, createdAt: orderCreatedAt }, update: { tenantId: demoTenantId, orderId, branchId, shiftId: shift.id, method: payment.method, amount: payment.amount, tendered, changeGiven: payment.method === "CASH" ? 20 : null, reference: payment.method === "CARD" ? `DEMO-${String(orderIndex + 1).padStart(4, "0")}` : null, createdById: shift.userId, createdAt: orderCreatedAt } });
          if (payment.method === "CASH") cashByShift.set(shift.id, (cashByShift.get(shift.id) ?? 0) + payment.amount);
          paymentIndex += 1;
        }
        for (const [ingredientIndex, quantity] of itemUsage) {
          runningStock[branchIndex][ingredientIndex] -= quantity;
          stockMovementRows.push({ id: id(8001 + orderIndex * 20 + ingredientIndex), branchId, ingredientIndex, quantity: -quantity, type: "RECIPE_USAGE", salesOrderId: orderId, note: `Sample sale ${String(orderIndex + 1).padStart(3, "0")}`, createdAt: orderCreatedAt });
        }
        if (orderIndex === refundOrderIndex) {
          const line = lineRows[0];
          const itemId = id(5001 + orderIndex * 10 + line.lineIndex);
          const itemAmount = line.unitPrice;
          const serviceAmount = round(itemAmount / subtotalAmount * serviceChargeAmount);
          const itemTax = round(itemAmount / subtotalAmount * taxAmount);
          refundContext = { orderId, itemId, branchId, actorId: seededUsers.MANAGER, shiftId: shift.id, quantity: 1, amount: round(itemAmount + serviceAmount + itemTax), taxAmount: itemTax, serviceAmount, itemAmount, ingredientUsage: productConsumption(line.productIndex, 1, line.oatMilk), createdAt: new Date(orderCreatedAt.getTime() + 60 * 60_000) };
        }
      }
    }

    for (const [branchIndex, branchId] of branchIds.entries()) {
      const wasteQuantity = branchIndex === 0 ? 450 : 250;
      runningStock[branchIndex][1] -= wasteQuantity;
      stockMovementRows.push({ id: id(9001 + branchIndex), branchId, ingredientIndex: 1, quantity: -wasteQuantity, type: "WASTE", note: "Milk past its safe service window", createdAt: daysAgo(2) });
    }

    if (refundContext) {
      const refundId = id(9101);
      await tx.refund.upsert({ where: { id: refundId }, create: { id: refundId, tenantId: demoTenantId, orderId: refundContext.orderId, branchId: refundContext.branchId, shiftId: refundContext.shiftId, amount: refundContext.amount, taxAmount: refundContext.taxAmount, reason: "Guest reported the drink was prepared incorrectly.", restock: true, method: "CASH", createdById: refundContext.actorId, approvedById: seededUsers.MANAGER, createdAt: refundContext.createdAt }, update: { tenantId: demoTenantId, orderId: refundContext.orderId, branchId: refundContext.branchId, shiftId: refundContext.shiftId, amount: refundContext.amount, taxAmount: refundContext.taxAmount, reason: "Guest reported the drink was prepared incorrectly.", restock: true, method: "CASH", createdById: refundContext.actorId, approvedById: seededUsers.MANAGER, createdAt: refundContext.createdAt } });
      const refundItemId = id(9102);
      await tx.refundItem.upsert({ where: { id: refundItemId }, create: { id: refundItemId, refundId, orderItemId: refundContext.itemId, quantity: 1, amount: refundContext.itemAmount, taxAmount: refundContext.taxAmount }, update: { refundId, orderItemId: refundContext.itemId, quantity: 1, amount: refundContext.itemAmount, taxAmount: refundContext.taxAmount } });
      for (const [ingredientIndex, quantity] of refundContext.ingredientUsage) {
        const branchIndex = refundContext.branchId === branchIds[0] ? 0 : 1;
        runningStock[branchIndex][ingredientIndex] += quantity;
        stockMovementRows.push({ id: id(9150 + ingredientIndex), branchId: refundContext.branchId, ingredientIndex, quantity, type: "REFUND_RESTOCK", salesOrderId: refundContext.orderId, note: `Restocked refund ${refundId}`, createdAt: refundContext.createdAt });
      }
      await tx.cashMovement.upsert({ where: { id: id(9201) }, create: { id: id(9201), tenantId: demoTenantId, branchId: refundContext.branchId, shiftId: refundContext.shiftId, type: "PAY_OUT", amount: refundContext.amount, note: "Cash refund to guest", createdById: refundContext.actorId, createdAt: refundContext.createdAt }, update: { tenantId: demoTenantId, branchId: refundContext.branchId, shiftId: refundContext.shiftId, type: "PAY_OUT", amount: refundContext.amount, note: "Cash refund to guest", createdById: refundContext.actorId, createdAt: refundContext.createdAt } });
      cashByShift.set(refundContext.shiftId, (cashByShift.get(refundContext.shiftId) ?? 0) - refundContext.amount);
    }

    const cashExpenseId = id(9301);
    const cashExpense = 1850;
    const cashMovementId = id(9302);
    await tx.cashMovement.upsert({ where: { id: cashMovementId }, create: { id: cashMovementId, tenantId: demoTenantId, branchId: branchIds[0], shiftId: shifts[0].id, type: "PAY_OUT", amount: cashExpense, reference: "PETTY-001", note: "Emergency cleaning supplies", createdById: seededUsers.MANAGER, createdAt: daysAgo(14) }, update: { tenantId: demoTenantId, branchId: branchIds[0], shiftId: shifts[0].id, type: "PAY_OUT", amount: cashExpense, reference: "PETTY-001", note: "Emergency cleaning supplies", createdById: seededUsers.MANAGER, createdAt: daysAgo(14) } });
    cashByShift.set(shifts[0].id, (cashByShift.get(shifts[0].id) ?? 0) - cashExpense);
    const expenseRows = [
      { id: cashExpenseId, category: 3, branch: 0, amount: cashExpense, paymentMethod: "CASH" as const, description: "Emergency cleaning supplies", shiftId: shifts[0].id, cashMovementId, day: 14 },
      ...Array.from({ length: 14 }, (_, index) => ({ id: id(9310 + index), category: index % expenseCategoryNames.length, branch: index % 2, amount: [12000, 4600, 1850, 2350, 3200][index % 5], paymentMethod: (index % 3 === 0 ? "BANK_TRANSFER" : "CARD") as "BANK_TRANSFER" | "CARD", description: ["Monthly premises rent", "Electricity and water", "Staff meal supplies", "Cleaning and service supplies", "Local community promotion"][index % 5], shiftId: undefined, cashMovementId: undefined, day: index + 1 })),
    ];
    for (const expense of expenseRows) {
      await tx.expense.upsert({ where: { id: expense.id }, create: { id: expense.id, tenantId: demoTenantId, branchId: branchIds[expense.branch], categoryId: expenseCategoryIds[expense.category], amount: expense.amount, expenseDate: daysAgo(expense.day), description: expense.description, paymentMethod: expense.paymentMethod, reference: expense.cashMovementId ? "PETTY-001" : `BILL-${expense.day}`, shiftId: expense.shiftId, cashMovementId: expense.cashMovementId, createdById: seededUsers.MANAGER }, update: { tenantId: demoTenantId, branchId: branchIds[expense.branch], categoryId: expenseCategoryIds[expense.category], amount: expense.amount, expenseDate: daysAgo(expense.day), description: expense.description, paymentMethod: expense.paymentMethod, reference: expense.cashMovementId ? "PETTY-001" : `BILL-${expense.day}`, shiftId: expense.shiftId, cashMovementId: expense.cashMovementId, createdById: seededUsers.MANAGER, voidedAt: null, voidedById: null, voidReason: null } });
    }

    for (const movement of stockMovementRows) {
      await tx.stockMovement.upsert({ where: { id: movement.id }, create: { id: movement.id, tenantId: demoTenantId, branchId: movement.branchId, ingredientId: ingredientIds[movement.ingredientIndex], purchaseId: movement.purchaseId, salesOrderId: movement.salesOrderId, type: movement.type, quantity: movement.quantity, note: movement.note, createdById: seededUsers.INVENTORY_MANAGER, createdAt: movement.createdAt }, update: { tenantId: demoTenantId, branchId: movement.branchId, ingredientId: ingredientIds[movement.ingredientIndex], purchaseId: movement.purchaseId, salesOrderId: movement.salesOrderId, type: movement.type, quantity: movement.quantity, note: movement.note, createdById: seededUsers.INVENTORY_MANAGER, createdAt: movement.createdAt } });
    }
    for (const [branchIndex, branchId] of branchIds.entries()) {
      for (const [ingredientIndex, ingredient] of ingredientRows.entries()) {
        await tx.stockLevel.upsert({ where: { branchId_ingredientId: { branchId, ingredientId: ingredientIds[ingredientIndex] } }, create: { tenantId: demoTenantId, branchId, ingredientId: ingredientIds[ingredientIndex], quantity: Math.max(0, round(runningStock[branchIndex][ingredientIndex])), averageCost: ingredient.unitCost, reorderLevel: ingredient.reorderLevel }, update: { tenantId: demoTenantId, quantity: Math.max(0, round(runningStock[branchIndex][ingredientIndex])), averageCost: ingredient.unitCost, reorderLevel: ingredient.reorderLevel } });
      }
    }

    const stocktakeId = id(9401);
    await tx.stocktake.upsert({ where: { id: stocktakeId }, create: { id: stocktakeId, tenantId: demoTenantId, branchId: branchIds[0], status: "DRAFT", startedAt: new Date(), createdById: seededUsers.INVENTORY_MANAGER, note: "Weekly cycle count in progress" }, update: { tenantId: demoTenantId, branchId: branchIds[0], status: "DRAFT", submittedAt: null, approvedAt: null, createdById: seededUsers.INVENTORY_MANAGER, approvedById: null, note: "Weekly cycle count in progress" } });
    for (const ingredientIndex of [0, 1, 4, 6]) {
      const lineId = id(9410 + ingredientIndex);
      const expected = runningStock[0][ingredientIndex];
      await tx.stocktakeLine.upsert({ where: { stocktakeId_ingredientId: { stocktakeId, ingredientId: ingredientIds[ingredientIndex] } }, create: { id: lineId, stocktakeId, ingredientId: ingredientIds[ingredientIndex], countedQuantity: Math.max(0, round(expected - (ingredientIndex % 2 ? 25 : 0))), countedAt: new Date(), expectedAtCount: round(expected), variance: ingredientIndex % 2 ? -25 : 0, unitCost: ingredientRows[ingredientIndex].unitCost }, update: { countedQuantity: Math.max(0, round(expected - (ingredientIndex % 2 ? 25 : 0))), countedAt: new Date(), expectedAtCount: round(expected), variance: ingredientIndex % 2 ? -25 : 0, unitCost: ingredientRows[ingredientIndex].unitCost } });
    }

    const tickets = [
      { id: id(9501), createdById: seededUsers.OWNER, assignedStaffId: supportStaff.id, type: "FEEDBACK" as const, priority: "NORMAL" as const, status: "RESOLVED" as const, subject: "The weekly sales view is helpful", message: "The branch comparison made our Monday planning easier. Please add an export to CSV when available.", day: 8 },
      { id: id(9502), createdById: seededUsers.CASHIER, assignedStaffId: supportStaff.id, type: "SUPPORT" as const, priority: "HIGH" as const, status: "IN_PROGRESS" as const, subject: "Receipt printer disconnects after sleep", message: "The counter printer reconnects after a manual restart. We are testing a powered USB hub.", day: 2 },
      { id: id(9503), createdById: seededUsers.MANAGER, assignedStaffId: null, type: "COMPLAINT" as const, priority: "NORMAL" as const, status: "OPEN" as const, subject: "Supplier delivery arrived late", message: "The morning dairy delivery arrived after opening, so we used reserve stock. Please confirm the supplier escalation contact.", day: 1 },
    ];
    for (const ticket of tickets) {
      await tx.platformTicket.upsert({ where: { id: ticket.id }, create: { id: ticket.id, tenantId: demoTenantId, createdById: ticket.createdById, assignedStaffId: ticket.assignedStaffId, type: ticket.type, priority: ticket.priority, status: ticket.status, subject: ticket.subject, message: ticket.message, createdAt: daysAgo(ticket.day) }, update: { tenantId: demoTenantId, createdById: ticket.createdById, assignedStaffId: ticket.assignedStaffId, type: ticket.type, priority: ticket.priority, status: ticket.status, subject: ticket.subject, message: ticket.message, createdAt: daysAgo(ticket.day) } });
    }
    const auditEntries: Array<{ action: string; detail: Record<string, string | number> }> = [
      { action: "menu.product.created", detail: { productId: productIds[0], sku: "COF-ESP" } },
      { action: "purchase.received", detail: { purchaseId: purchaseBaseIds[0], lineCount: ingredientRows.length } },
      { action: "order.refund", detail: { orderId: id(4001 + refundOrderIndex), reason: "Prepared incorrectly" } },
      { action: "stocktake.started", detail: { stocktakeId } },
    ];
    for (const [index, entry] of auditEntries.entries()) {
      const auditId = id(9701 + index);
      await tx.auditLog.upsert({ where: { id: auditId }, create: { id: auditId, userId: seededUsers.MANAGER, action: entry.action, metadata: { tenantId: demoTenantId, branchId: branchIds[0], demoRecord: true, detail: entry.detail }, createdAt: daysAgo(index + 1) }, update: { userId: seededUsers.MANAGER, action: entry.action, metadata: { tenantId: demoTenantId, branchId: branchIds[0], demoRecord: true, detail: entry.detail }, createdAt: daysAgo(index + 1) } });
    }

    for (const shift of shifts) {
      const expectedCash = round(shift.openingCash + (cashByShift.get(shift.id) ?? 0));
      await tx.shift.update({ where: { id: shift.id }, data: { expectedCash, ...(shift.status === "CLOSED" ? { closingCash: round(expectedCash + (shift.id === id(2001) ? -35 : 20)), cashVariance: shift.id === id(2001) ? -35 : 20 } : {}) } });
    }
  }, { maxWait: 10_000, timeout: 120_000 });

  console.info("Seeded an idempotent Himalayan Brew demo dataset: two branches, catalog, recipes, suppliers, purchasing, stock ledger, 28 completed sales, two open table orders, shifts, expenses, feedback and reports-ready history.");
}

try {
  await seedDemoPosData();
} finally {
  await prisma.$disconnect();
}
