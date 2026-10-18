// Generated from shared/system-constants.json. Do not edit by hand.

export const BUSINESS_ROLE_VALUES = ["OWNER","MANAGER","CASHIER","WAITER","KITCHEN_STAFF","INVENTORY_MANAGER"] as const;
export type BusinessRole = (typeof BUSINESS_ROLE_VALUES)[number];

export const PLATFORM_ROLE_VALUES = ["SUPER_ADMIN","SUPPORT_AGENT"] as const;
export type PlatformRole = (typeof PLATFORM_ROLE_VALUES)[number];

export const TENANT_STATUS_VALUES = ["ACTIVE","SUSPENDED"] as const;
export type TenantStatus = (typeof TENANT_STATUS_VALUES)[number];

export const SUBSCRIPTION_STATUS_VALUES = ["TRIALING","ACTIVE","PENDING_PAYMENT","PAST_DUE","CANCELED","EXPIRED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number];

export const MEASURE_UNIT_VALUES = ["EACH","GRAM","KILOGRAM","MILLILITER","LITER","OUNCE","POUND"] as const;
export type MeasureUnit = (typeof MEASURE_UNIT_VALUES)[number];

export const PAYMENT_METHOD_VALUES = ["CASH","CARD","BANK_TRANSFER","DIGITAL_WALLET","OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD_VALUES)[number];

export const PURCHASE_STATUS_VALUES = ["DRAFT","ORDERED","PARTIALLY_RECEIVED","RECEIVED","CANCELLED"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUS_VALUES)[number];

export const STOCKTAKE_STATUS_VALUES = ["DRAFT","SUBMITTED","APPROVED","CANCELLED"] as const;
export type StocktakeStatus = (typeof STOCKTAKE_STATUS_VALUES)[number];

export const STOCK_MOVEMENT_TYPE_VALUES = ["PURCHASE_RECEIVED","WASTE","ADJUSTMENT","RECIPE_USAGE","REFUND_RESTOCK","STOCKTAKE"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPE_VALUES)[number];

export const SALES_ORDER_STATUS_VALUES = ["OPEN","COMPLETED","PARTIALLY_REFUNDED","REFUNDED","CANCELLED"] as const;
export type SalesOrderStatus = (typeof SALES_ORDER_STATUS_VALUES)[number];

export const KITCHEN_ORDER_STATUS_VALUES = ["PENDING","PREPARING","READY"] as const;
export type KitchenOrderStatus = (typeof KITCHEN_ORDER_STATUS_VALUES)[number];

export const KITCHEN_ITEM_STATUS_VALUES = ["NEW","PREPARING","READY","SERVED"] as const;
export type KitchenItemStatus = (typeof KITCHEN_ITEM_STATUS_VALUES)[number];

export const SHIFT_STATUS_VALUES = ["OPEN","CLOSED"] as const;
export type ShiftStatus = (typeof SHIFT_STATUS_VALUES)[number];

export const CASH_MOVEMENT_TYPE_VALUES = ["PAY_IN","PAY_OUT"] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPE_VALUES)[number];

export const PLATFORM_TICKET_TYPE_VALUES = ["COMPLAINT","FEEDBACK","SUPPORT"] as const;
export type PlatformTicketType = (typeof PLATFORM_TICKET_TYPE_VALUES)[number];

export const PLATFORM_TICKET_STATUS_VALUES = ["OPEN","IN_PROGRESS","RESOLVED","CLOSED"] as const;
export type PlatformTicketStatus = (typeof PLATFORM_TICKET_STATUS_VALUES)[number];

export const PLATFORM_TICKET_PRIORITY_VALUES = ["LOW","NORMAL","HIGH","URGENT"] as const;
export type PlatformTicketPriority = (typeof PLATFORM_TICKET_PRIORITY_VALUES)[number];

export const STOCK_ADJUSTMENT_TYPE_VALUES = ["WASTE","ADJUSTMENT"] as const;
export type StockAdjustmentType = (typeof STOCK_ADJUSTMENT_TYPE_VALUES)[number];

export const KITCHEN_ITEM_TRANSITION_STATUS_VALUES = ["NEW","PREPARING","READY"] as const;
export type KitchenItemTransitionStatus = (typeof KITCHEN_ITEM_TRANSITION_STATUS_VALUES)[number];

export const APP_ROLES = [...BUSINESS_ROLE_VALUES, "PLATFORM_ADMIN"] as const;
export type AppRole = (typeof APP_ROLES)[number];

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

export type StatusTone = "positive" | "warning" | "danger" | "info" | "neutral";
export interface StatusPresentation { readonly label: string; readonly tone: StatusTone; readonly description: string }
export const STATUS_PRESENTATION = {
  TenantStatus: {
    ACTIVE: { label: "Active", tone: "positive", description: "Business is active" },
    SUSPENDED: { label: "Suspended", tone: "danger", description: "Business access is suspended" },
  } satisfies Record<(typeof TENANT_STATUS_VALUES)[number], StatusPresentation>,
  SubscriptionStatus: {
    TRIALING: { label: "Trialing", tone: "info", description: "Subscription is in its trial period" },
    ACTIVE: { label: "Active", tone: "positive", description: "Subscription is active" },
    PENDING_PAYMENT: { label: "Pending payment", tone: "warning", description: "Payment is required" },
    PAST_DUE: { label: "Past due", tone: "danger", description: "Payment is overdue" },
    CANCELED: { label: "Canceled", tone: "neutral", description: "Subscription was canceled" },
    EXPIRED: { label: "Expired", tone: "neutral", description: "Subscription has expired" },
  } satisfies Record<(typeof SUBSCRIPTION_STATUS_VALUES)[number], StatusPresentation>,
  PurchaseStatus: {
    DRAFT: { label: "Draft", tone: "neutral", description: "Purchase has not been placed" },
    ORDERED: { label: "Ordered", tone: "info", description: "Purchase is awaiting delivery" },
    PARTIALLY_RECEIVED: { label: "Partially received", tone: "warning", description: "Some items are outstanding" },
    RECEIVED: { label: "Received", tone: "positive", description: "All items were received" },
    CANCELLED: { label: "Cancelled", tone: "neutral", description: "Purchase was cancelled" },
  } satisfies Record<(typeof PURCHASE_STATUS_VALUES)[number], StatusPresentation>,
  StocktakeStatus: {
    DRAFT: { label: "Draft", tone: "neutral", description: "Counts are still being entered" },
    SUBMITTED: { label: "Submitted", tone: "info", description: "Awaiting approval" },
    APPROVED: { label: "Approved", tone: "positive", description: "Stocktake was approved" },
    CANCELLED: { label: "Cancelled", tone: "neutral", description: "Stocktake was cancelled" },
  } satisfies Record<(typeof STOCKTAKE_STATUS_VALUES)[number], StatusPresentation>,
  SalesOrderStatus: {
    OPEN: { label: "Open", tone: "warning", description: "Order is still in progress" },
    COMPLETED: { label: "Completed", tone: "positive", description: "Order has been paid" },
    PARTIALLY_REFUNDED: { label: "Partially refunded", tone: "warning", description: "Part of the payment was refunded" },
    REFUNDED: { label: "Refunded", tone: "neutral", description: "Payment was refunded" },
    CANCELLED: { label: "Cancelled", tone: "danger", description: "Order was cancelled" },
  } satisfies Record<(typeof SALES_ORDER_STATUS_VALUES)[number], StatusPresentation>,
  KitchenOrderStatus: {
    PENDING: { label: "Pending", tone: "warning", description: "Order is waiting for kitchen work" },
    PREPARING: { label: "Preparing", tone: "info", description: "Kitchen is preparing this order" },
    READY: { label: "Ready", tone: "positive", description: "Order is ready to serve" },
  } satisfies Record<(typeof KITCHEN_ORDER_STATUS_VALUES)[number], StatusPresentation>,
  KitchenItemStatus: {
    NEW: { label: "New", tone: "warning", description: "Item has not been started" },
    PREPARING: { label: "Preparing", tone: "info", description: "Item is being prepared" },
    READY: { label: "Ready", tone: "positive", description: "Item is ready" },
    SERVED: { label: "Served", tone: "neutral", description: "Item was served" },
  } satisfies Record<(typeof KITCHEN_ITEM_STATUS_VALUES)[number], StatusPresentation>,
  ShiftStatus: {
    OPEN: { label: "Open", tone: "positive", description: "Cash drawer is open" },
    CLOSED: { label: "Closed", tone: "neutral", description: "Cash drawer is closed" },
  } satisfies Record<(typeof SHIFT_STATUS_VALUES)[number], StatusPresentation>,
  PlatformTicketStatus: {
    OPEN: { label: "Open", tone: "warning", description: "Ticket needs attention" },
    IN_PROGRESS: { label: "In progress", tone: "info", description: "Ticket is being handled" },
    RESOLVED: { label: "Resolved", tone: "positive", description: "Ticket was resolved" },
    CLOSED: { label: "Closed", tone: "neutral", description: "Ticket is closed" },
  } satisfies Record<(typeof PLATFORM_TICKET_STATUS_VALUES)[number], StatusPresentation>,
  PlatformTicketPriority: {
    LOW: { label: "Low", tone: "neutral", description: "Low priority" },
    NORMAL: { label: "Normal", tone: "info", description: "Standard priority" },
    HIGH: { label: "High", tone: "warning", description: "High priority" },
    URGENT: { label: "Urgent", tone: "danger", description: "Urgent priority" },
  } satisfies Record<(typeof PLATFORM_TICKET_PRIORITY_VALUES)[number], StatusPresentation>,
} as const;

export type StatusDomain = keyof typeof STATUS_PRESENTATION;
export type StatusFor<Domain extends StatusDomain> = keyof (typeof STATUS_PRESENTATION)[Domain];
export function getStatusPresentation<Domain extends StatusDomain>(domain: Domain, status: StatusFor<Domain>): StatusPresentation {
  return STATUS_PRESENTATION[domain][status] as StatusPresentation;
}

export const UNIT_PRESENTATION = {
  EACH: { label: "Each", abbreviation: "ea" },
  GRAM: { label: "Gram", abbreviation: "g" },
  KILOGRAM: { label: "Kilogram", abbreviation: "kg" },
  MILLILITER: { label: "Milliliter", abbreviation: "ml" },
  LITER: { label: "Liter", abbreviation: "l" },
  OUNCE: { label: "Ounce", abbreviation: "oz" },
  POUND: { label: "Pound", abbreviation: "lb" },
} as const satisfies Record<MeasureUnit, { label: string; abbreviation: string }>;
export const PAYMENT_METHOD_LABELS = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  DIGITAL_WALLET: "Digital wallet",
  OTHER: "Other",
} as const satisfies Record<PaymentMethod, string>;
