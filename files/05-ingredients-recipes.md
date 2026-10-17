# 05 Ingredients and recipes

## Real-world example

Dipak sets up Thamel's ingredients: coffee beans (g, NPR 2.20 per g), dairy milk (ml, NPR 0.12), oat milk (ml, NPR 0.40), regular cup and large cup (pcs, NPR 4 and NPR 6). The Latte recipe uses 18 g beans, 250 ml milk and 1 regular cup. The Large option adds 6 g beans and swaps the regular cup for a large cup. The Oat option removes 250 ml dairy milk and adds 250 ml oat milk.

One Large Oat Latte therefore uses 24 g beans, 0 ml dairy milk, 250 ml oat milk, 1 large cup. Cost: 24 x 2.20 + 250 x 0.40 + 6 = 158.80. Sold at 420.00, food cost is 37.8 percent.

## Models

| Model | Fields |
|---|---|
| Ingredient | id, tenantId, name, baseUnit (g, ml, pcs), costPerBaseUnit, reorderLevel, purchaseUnit, purchaseUnitFactor, isActive, createdAt, updatedAt. Unique (tenantId, name) |
| RecipeItem | id, productId, ingredientId, quantity. Unique (productId, ingredientId) |
| ModifierOptionRecipeItem | id, optionId, ingredientId, quantityDelta (may be negative). Unique pair |

`purchaseUnit` and `purchaseUnitFactor` describe how the ingredient is bought, for example unit `kg` with factor 1000 for a base unit of g.

## Endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| GET /ingredients | inventory.read | List with current stock for a branch |
| POST /ingredients | inventory.adjust | Create |
| PATCH /ingredients/:id | inventory.adjust | Update, cannot change baseUnit once used |
| GET /products/:id/recipe | menu.read | Recipe with costs |
| PUT /products/:id/recipe | menu.manage | Replace recipe |
| PUT /modifier-options/:id/recipe | menu.manage | Replace option effects |
| GET /recipes/costs | reports.profit.read | Cost and margin per product |

## Backend logic

### Ingredient rules

1. `baseUnit` must be one of g, ml, pcs and cannot change after any StockMovement exists.
2. `costPerBaseUnit` is the default cost used before a branch has its own average cost (see 09).
3. Name unique per tenant. Archive instead of delete when referenced.

### Save recipe

1. Load the product and every ingredient with tenantId in one query. Any missing ID returns 404.
2. Reject duplicates and non-positive quantities.
3. Replace all RecipeItem rows in a transaction.
4. Audit `recipe.update` with before and after.

### Recipes are optional

A product without recipe rows can still be sold. Sales of such products create no stock movements and show unknown cost in reports. The dashboard shows a "Products without recipes" count to encourage setup.

### Effective consumption for an order line

```ts
export function consumption(
  recipe: { ingredientId: string; quantity: Prisma.Decimal }[],
  optionEffects: { ingredientId: string; quantityDelta: Prisma.Decimal }[],
  lineQuantity: Prisma.Decimal,
): Map<string, Prisma.Decimal> {
  const totals = new Map<string, Prisma.Decimal>();
  for (const r of recipe) {
    totals.set(r.ingredientId, (totals.get(r.ingredientId) ?? new Prisma.Decimal(0)).plus(r.quantity));
  }
  for (const e of optionEffects) {
    totals.set(e.ingredientId, (totals.get(e.ingredientId) ?? new Prisma.Decimal(0)).plus(e.quantityDelta));
  }
  for (const [id, q] of totals) {
    const final = q.times(lineQuantity);
    if (final.lte(0)) totals.delete(id);
    else totals.set(id, final);
  }
  return totals;
}
```

The function sums the base recipe and all selected option deltas, multiplies by the line quantity, and drops ingredients that net to zero or less (for example dairy milk in the oat latte).

### Unit cost snapshot

When an order is created, `OrderItem.unitCost` is the sum over consumption of `quantity x averageCost` for the branch, divided by line quantity. If an ingredient has no branch average yet, `Ingredient.costPerBaseUnit` is used. The snapshot makes historical profit stable.

### Recipe costs report

For each product: sum of recipe quantity times current cost, price, margin, food cost percent. Needs `reports.profit.read`.

### Integrity

A recipe item's ingredient and product must share the tenant. The service checks this because a foreign key cannot.

## Frontend logic

### Ingredient list (`/inventory/ingredients`)

Table: name, unit, cost, stock in the selected branch, reorder level, status. Add dialog with name, unit select, cost, reorder level, optional purchase unit and factor. Low-stock rows get a warning badge.

### Recipe editor (inside the product sheet)

Repeater rows: ingredient combobox (shadcn Command), quantity input with unit suffix. A live panel shows recipe cost, price, margin and food cost percent computed from API-provided costs (display only). Save sends the whole recipe.

### Option effects editor

In the modifier editor, each option has an Ingredient effects repeater with a signed quantity so the manager can enter -250 for dairy milk and +250 for oat milk.

### States

Empty recipe shows "No recipe. Stock will not be tracked for this item." Costs missing show a dash.

## Tests

Oat option removes dairy milk and adds oat milk. Quantity multiplies by line quantity. Zero-net ingredients are dropped. Recipe with another tenant's ingredient is rejected. Product without recipe sells with no movements.
