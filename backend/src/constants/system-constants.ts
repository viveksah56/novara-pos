// Generated from shared/system-constants.json. Do not edit by hand.
import { z } from "zod";

export const BUSINESS_ROLE_VALUES = ["OWNER","MANAGER","CASHIER","WAITER","KITCHEN_STAFF","INVENTORY_MANAGER"] as const;
export type BusinessRole = (typeof BUSINESS_ROLE_VALUES)[number];
export const businessRoleSchema = z.enum(BUSINESS_ROLE_VALUES);

export const PLATFORM_ROLE_VALUES = ["SUPER_ADMIN","SUPPORT_AGENT"] as const;
export type PlatformRole = (typeof PLATFORM_ROLE_VALUES)[number];
export const platformRoleSchema = z.enum(PLATFORM_ROLE_VALUES);

export const TENANT_STATUS_VALUES = ["ACTIVE","SUSPENDED"] as const;
export type TenantStatus = (typeof TENANT_STATUS_VALUES)[number];
export const tenantStatusSchema = z.enum(TENANT_STATUS_VALUES);

export const SUBSCRIPTION_STATUS_VALUES = ["TRIALING","ACTIVE","PENDING_PAYMENT","PAST_DUE","CANCELED","EXPIRED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];
export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUS_VALUES);

export const MEASURE_UNIT_VALUES = ["EACH","GRAM","KILOGRAM","MILLILITER","LITER","OUNCE","POUND"] as const;
export type MeasureUnit = (typeof MEASURE_UNIT_VALUES)[number];
export const measureUnitSchema = z.enum(MEASURE_UNIT_VALUES);

export const PAYMENT_METHOD_VALUES = ["CASH","CARD","BANK_TRANSFER","DIGITAL_WALLET","OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];
export const paymentMethodSchema = z.enum(PAYMENT_METHOD_VALUES);

export const PURCHASE_STATUS_VALUES = ["DRAFT","ORDERED","PARTIALLY_RECEIVED","RECEIVED","CANCELLED"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUS_VALUES)[number];
export const purchaseStatusSchema = z.enum(PURCHASE_STATUS_VALUES);

export const STOCKTAKE_STATUS_VALUES = ["DRAFT","SUBMITTED","APPROVED","CANCELLED"] as const;
export type StocktakeStatus = (typeof STOCKTAKE_STATUS_VALUES)[number];
export const stocktakeStatusSchema = z.enum(STOCKTAKE_STATUS_VALUES);

export const STOCK_MOVEMENT_TYPE_VALUES = ["PURCHASE_RECEIVED","WASTE","ADJUSTMENT","RECIPE_USAGE","REFUND_RESTOCK","STOCKTAKE"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPE_VALUES)[number];
export const stockMovementTypeSchema = z.enum(STOCK_MOVEMENT_TYPE_VALUES);

export const SALES_ORDER_STATUS_VALUES = ["OPEN","COMPLETED","PARTIALLY_REFUNDED","REFUNDED","CANCELLED"] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUS_VALUES)[number];
export const salesOrderStatusSchema = z.enum(SALES_ORDER_STATUS_VALUES);

export const KITCHEN_ORDER_STATUS_VALUES = ["PENDING","PREPARING","READY"] as const;
export type KitchenOrderStatus = (typeof KITCHEN_ORDER_STATUS_VALUES)[number];
export const kitchenOrderStatusSchema = z.enum(KITCHEN_ORDER_STATUS_VALUES);

export const KITCHEN_ITEM_STATUS_VALUES = ["NEW","PREPARING","READY","SERVED"] as const;
export type KitchenItemStatus = (typeof KITCHEN_ITEM_STATUS_VALUES)[number];
export const kitchenItemStatusSchema = z.enum(KITCHEN_ITEM_STATUS_VALUES);

export const SHIFT_STATUS_VALUES = ["OPEN","CLOSED"] as const;
export type ShiftStatus = (typeof SHIFT_STATUS_VALUES)[number];
export const shiftStatusSchema = z.enum(SHIFT_STATUS_VALUES);

export const CASH_MOVEMENT_TYPE_VALUES = ["PAY_IN","PAY_OUT"] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPE_VALUES)[number];
export const cashMovementTypeSchema = z.enum(CASH_MOVEMENT_TYPE_VALUES);

export const PLATFORM_TICKET_TYPE_VALUES = ["COMPLAINT","FEEDBACK","SUPPORT"] as const;
export type PlatformTicketType = (typeof PLATFORM_TICKET_TYPE_VALUES)[number];
export const platformTicketTypeSchema = z.enum(PLATFORM_TICKET_TYPE_VALUES);

export const PLATFORM_TICKET_STATUS_VALUES = ["OPEN","IN_PROGRESS","RESOLVED","CLOSED"] as const;
export type PlatformTicketStatus = (typeof PLATFORM_TICKET_STATUS_VALUES)[number];
export const platformTicketStatusSchema = z.enum(PLATFORM_TICKET_STATUS_VALUES);

export const PLATFORM_TICKET_PRIORITY_VALUES = ["LOW","NORMAL","HIGH","URGENT"] as const;
export type PlatformTicketPriority = (typeof PLATFORM_TICKET_PRIORITY_VALUES)[number];
export const platformTicketPrioritySchema = z.enum(PLATFORM_TICKET_PRIORITY_VALUES);

export const STOCK_ADJUSTMENT_TYPE_VALUES = ["WASTE","ADJUSTMENT"] as const;
export type StockAdjustmentType = (typeof STOCK_ADJUSTMENT_TYPE_VALUES)[number];
export const stockAdjustmentTypeSchema = z.enum(STOCK_ADJUSTMENT_TYPE_VALUES);

export const KITCHEN_ITEM_TRANSITION_STATUS_VALUES = ["NEW","PREPARING","READY"] as const;
export type KitchenItemTransitionStatus = (typeof KITCHEN_ITEM_TRANSITION_STATUS_VALUES)[number];
export const kitchenItemTransitionStatusSchema = z.enum(KITCHEN_ITEM_TRANSITION_STATUS_VALUES);

export const APP_ROLES = [...BUSINESS_ROLE_VALUES, "PLATFORM_ADMIN"] as const;
export type AppRole = (typeof APP_ROLES)[number];
export const appRoleSchema = z.enum(APP_ROLES);

export const CAPABILITIES = ["reports.sales.read","reports.inventory.read","reports.profit.read","inventory.read","inventory.adjust","menu.read","menu.manage","staff.read","expenses.read","expenses.manage","settings.read","settings.manage","orders.create","orders.read","orders.update","orders.pay","orders.refund","receipts.print","discounts.apply","shifts.read","shifts.review","kitchen.orders.read","kitchen.orders.update","purchases.manage","suppliers.manage","subscription.manage","audit.read"] as const;
export type Capability = (typeof CAPABILITIES)[number];
export const BUSINESS_ROLE_CAPABILITIES = {
  "OWNER": [
    "reports.sales.read",
    "reports.inventory.read",
    "reports.profit.read",
    "inventory.read",
    "inventory.adjust",
    "menu.read",
    "menu.manage",
    "staff.read",
    "expenses.read",
    "expenses.manage",
    "settings.read",
    "settings.manage",
    "orders.create",
    "orders.read",
    "orders.update",
    "orders.pay",
    "orders.refund",
    "receipts.print",
    "discounts.apply",
    "shifts.read",
    "shifts.review",
    "kitchen.orders.read",
    "kitchen.orders.update",
    "purchases.manage",
    "suppliers.manage",
    "subscription.manage",
    "audit.read"
  ],
  "MANAGER": [
    "reports.sales.read",
    "reports.inventory.read",
    "inventory.read",
    "inventory.adjust",
    "menu.read",
    "menu.manage",
    "staff.read",
    "expenses.read",
    "expenses.manage",
    "settings.read",
    "orders.create",
    "orders.read",
    "orders.update",
    "orders.pay",
    "orders.refund",
    "receipts.print",
    "discounts.apply",
    "shifts.read",
    "shifts.review",
    "purchases.manage",
    "suppliers.manage"
  ],
  "CASHIER": [
    "menu.read",
    "orders.create",
    "orders.read",
    "orders.pay",
    "receipts.print",
    "discounts.apply",
    "shifts.read"
  ],
  "WAITER": [
    "menu.read",
    "orders.create",
    "orders.read",
    "orders.update"
  ],
  "KITCHEN_STAFF": [
    "kitchen.orders.read",
    "kitchen.orders.update"
  ],
  "INVENTORY_MANAGER": [
    "menu.read",
    "inventory.read",
    "inventory.adjust",
    "reports.inventory.read",
    "purchases.manage",
    "suppliers.manage"
  ]
} as const satisfies Record<BusinessRole, readonly Capability[]>;
