/** Capabilities used by the optimistic route guard. The API repeats every check. */
export type BusinessRole = "OWNER" | "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN_STAFF" | "INVENTORY_MANAGER";
export type PlatformRole = "SUPER_ADMIN" | "PLATFORM_ADMIN" | "SUPPORT_AGENT";
export type Capability = "reports.sales.read" | "reports.inventory.read" | "inventory.read" | "menu.manage" | "staff.read" | "expenses.read" | "expenses.manage" | "settings.read" | "settings.manage" | "orders.create" | "orders.read" | "shifts.read" | "kitchen.orders.read" | "kitchen.orders.update";

export const ROUTE_CAPABILITIES: ReadonlyArray<{ path: string; capability: Capability }> = [
  { path: "/dashboard/reports", capability: "reports.sales.read" },
  { path: "/dashboard/inventory", capability: "inventory.read" },
  { path: "/dashboard/settings", capability: "settings.read" },
  { path: "/reports", capability: "reports.sales.read" },
  { path: "/stock-reports", capability: "reports.inventory.read" },
  { path: "/expenses", capability: "expenses.read" },
  { path: "/inventory/recipes", capability: "menu.manage" },
  { path: "/inventory", capability: "inventory.read" },
  { path: "/menu", capability: "menu.manage" },
  { path: "/team", capability: "staff.read" },
  { path: "/settings", capability: "settings.read" },
  { path: "/branches", capability: "settings.read" },
  { path: "/orders", capability: "orders.read" },
  { path: "/tables", capability: "orders.read" },
  { path: "/shift", capability: "shifts.read" },
  { path: "/pos", capability: "orders.create" },
  { path: "/kitchen", capability: "kitchen.orders.read" },
];

export const ROLE_CAPABILITIES: Record<BusinessRole, ReadonlySet<Capability>> = {
  OWNER: new Set(["reports.sales.read", "reports.inventory.read", "inventory.read", "menu.manage", "staff.read", "expenses.read", "expenses.manage", "settings.read", "settings.manage", "orders.create", "orders.read", "shifts.read", "kitchen.orders.read", "kitchen.orders.update"]),
  MANAGER: new Set(["reports.sales.read", "reports.inventory.read", "inventory.read", "menu.manage", "staff.read", "expenses.read", "expenses.manage", "settings.read", "orders.create", "orders.read", "shifts.read", "kitchen.orders.read", "kitchen.orders.update"]),
  CASHIER: new Set(["orders.create", "orders.read", "shifts.read"]),
  WAITER: new Set(["orders.create", "orders.read"]),
  KITCHEN_STAFF: new Set(["kitchen.orders.read", "kitchen.orders.update"]),
  INVENTORY_MANAGER: new Set(["inventory.read", "reports.inventory.read"]),
};


export function capabilityForPath(pathname: string): Capability | undefined {
  return ROUTE_CAPABILITIES
    .filter(({ path }) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0]?.capability;
}

export function roleHasCapability(role: string | undefined, capability: Capability): boolean {
  return role !== undefined && role in ROLE_CAPABILITIES && ROLE_CAPABILITIES[role as BusinessRole].has(capability);
}
