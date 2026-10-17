# 04 Menu

## Real-world example

Sita builds the Thamel menu. Category Coffee holds Latte at NPR 280. Latte has a Size group (Regular +0, Large +60) and a Milk group (Dairy +0, Oat +80). Category Food holds Chicken Momo at NPR 220. In the morning Anil sees Coffee first and taps Latte, then Large and Oat, and the line price becomes 280 + 60 + 80 = 420.

## Models

| Model | Fields |
|---|---|
| Category | id, tenantId, name, sortOrder, isActive. Unique (tenantId, name) |
| Product | id, tenantId, categoryId, name, sku, description, imageUrl, price, taxExempt, isActive, sortOrder, trackStock, createdAt, updatedAt. Unique (tenantId, sku) |
| ModifierGroup | id, tenantId, name, minSelect, maxSelect, sortOrder |
| ModifierOption | id, groupId, name, priceDelta, isDefault, isActive, sortOrder |
| ProductModifierGroup | productId, groupId, sortOrder. Unique pair |
| ProductBranch | productId, branchId, priceOverride, isAvailable. Optional branch pricing |

Group rules: `minSelect` 0 means optional, 1 means required. `maxSelect` 1 is a single choice. Options with a price delta change the line price.

## Endpoints

| Method and path | Permission | Purpose |
|---|---|---|
| GET /categories | menu.read | List |
| POST /categories | menu.manage | Create |
| PATCH /categories/:id | menu.manage | Rename, reorder, archive |
| GET /products | menu.read | List with filters |
| POST /products | menu.manage | Create |
| GET /products/:id | menu.read | Details with modifiers |
| PATCH /products/:id | menu.manage | Update |
| POST /products/:id/archive | menu.manage | Hide from POS |
| GET /modifier-groups, POST, PATCH | menu.read, menu.manage | Manage groups and options |
| PUT /products/:id/modifier-groups | menu.manage | Attach groups |
| GET /pos/menu | orders.create | Compact active menu for a branch |
| POST /products/import | menu.manage | CSV import (P1) |

## Backend logic

### Create product

1. Validate name, price (Decimal string, 0 to 9,999,999.99), optional SKU.
2. Verify `categoryId` belongs to the tenant.
3. Check SKU uniqueness within the tenant.
4. Create with `isActive` true and next `sortOrder`.
5. Audit `product.create`.

### Update price

The product row changes. Existing orders keep their own `unitPrice` snapshot, so history never changes. The audit entry stores old and new price.

### Archive instead of delete

A product referenced by any OrderItem or recipe cannot be deleted. Archiving sets `isActive` false. Archived products disappear from the POS menu but stay in reports. A product with no references can be hard deleted by menu.manage.

### Modifier validation at order time

For each cart line the server loads the product's groups and checks that selected options belong to those groups, each group count is between minSelect and maxSelect, and options are active.

### POS menu endpoint

`GET /pos/menu?branchId=` returns active categories, available products with the effective price (branch override or base), and their modifier groups in one response. It sends an ETag derived from the highest `updatedAt` so the POS gets 304 on unchanged menus, plus `Cache-Control: private, max-age=60`.

```ts
const effectivePrice = (p: Product, override?: Prisma.Decimal | null) => override ?? p.price;
```

### CSV import (P1)

Columns: category, name, sku, price. Parse in the service, validate every row, create missing categories, return a per-row error report. The import runs in one transaction and rolls back if any row fails when `strict=true`.

## Frontend logic

### Menu manager (`/menu`)

Tabs: Products, Categories, Modifiers. Products table (TanStack Table) with search, category filter, active filter. Row click opens a Sheet with the product form: name, category, price, SKU, image upload, tax exempt, modifier group multi-select, recipe link (see 05). Drag handles reorder categories and products, saving `sortOrder` in one PATCH.

### Modifier editor

Group form with name, min and max selects, and a repeater for options with name and price delta. Validation: `maxSelect >= minSelect`, at least one option.

### POS consumption

The POS loads `/pos/menu` once, caches in TanStack Query with `staleTime` of 5 minutes and mirrors it into Dexie for offline use (see 15). Category tabs filter locally. Search uses a debounced input over name and SKU. Tapping a product with required modifiers opens a modifier dialog with radio and checkbox groups and a live line total preview (display only).

### States

Skeleton grid while loading, empty state "Add your first product" with a link when the menu is empty, error state with retry.

## Edge cases

| Case | Handling |
|---|---|
| Price edited during a shift | New orders use the new price, open carts are repriced by the server on submit |
| Product archived while in a cart | Server rejects the line with 409 and the POS removes it with a toast |
| Modifier group without options | Rejected on save |
| Duplicate SKU | 409 on sku field |

## Tests

Order totals use the order-time price after a price change. Archived product cannot be ordered. Modifier min and max are enforced. Product from another tenant cannot be attached to a category.
