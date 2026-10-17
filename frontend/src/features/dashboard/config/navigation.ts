import {
  Activity,
  Boxes,
  Building2,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Coffee,
  CreditCard,
  LayoutDashboard,
  MessageSquareText,
  Package,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { DashboardPayload } from "@/features/dashboard/api";
import type { Capability } from "@/lib/rbac";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  capability?: Capability;
  permission?: keyof NonNullable<DashboardPayload["permissions"]>;
  ready?: boolean;
};
export const navigation: Record<string, NavItem[]> = {
  OWNER: [
    {
      label: "Overview",
      href: "/dashboard",
      icon: LayoutDashboard,
      ready: true,
    },
    {
      label: "Point of sale",
      href: "/pos",
      icon: CreditCard,
      capability: "orders.create",
      ready: true,
    },
    { label: "Orders", href: "/orders", icon: ClipboardList, capability: "orders.read" },
    { label: "Tables", href: "/tables", icon: Store, capability: "orders.read" },
    { label: "Register shift", href: "/shift", icon: Clock3, capability: "shifts.read" },
    {
      label: "Menu & products",
      href: "/menu/products",
      icon: Coffee,
      ready: true,
    },
    { label: "Modifiers", href: "/menu/modifiers", icon: Coffee, ready: true },
    {
      label: "Inventory",
      href: "/inventory",
      icon: Package,
      capability: "inventory.read",
      permission: "inventoryRead",
    },
    { label: "Stocktakes", href: "/inventory/stocktakes", icon: ClipboardCheck, capability: "inventory.read", permission: "inventoryRead" },
    { label: "Stock reports", href: "/stock-reports", icon: Boxes, capability: "reports.inventory.read" },
    {
      label: "Reports",
      href: "/reports",
      icon: Activity,
      capability: "reports.sales.read",
      permission: "reportsSalesRead",
    },
    {
      label: "Team",
      href: "/team",
      icon: Users,
      permission: "staffRead",
      ready: true,
    },
    { label: "Branches", href: "/settings/branches", icon: Building2, capability: "settings.read", ready: true },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings2,
      capability: "settings.read",
    },
    { label: "Subscription", href: "/subscription", icon: Wallet, ready: true },
    {
      label: "Complaints & feedback",
      href: "/feedback",
      icon: MessageSquareText,
      ready: true,
    },
    { label: "Audit log", href: "/audit-log", icon: ShieldCheck, ready: false },
  ],
  MANAGER: [
    {
      label: "Branch overview",
      href: "/dashboard",
      icon: LayoutDashboard,
      ready: true,
    },
    {
      label: "Point of sale",
      href: "/pos",
      icon: CreditCard,
      capability: "orders.create",
      ready: true,
    },
    { label: "Orders", href: "/orders", icon: ClipboardList, capability: "orders.read" },
    { label: "Tables", href: "/tables", icon: Store, capability: "orders.read" },
    { label: "Register shift", href: "/shift", icon: Clock3, capability: "shifts.read" },
    {
      label: "Menu & products",
      href: "/menu/products",
      icon: Coffee,
      ready: true,
    },
    { label: "Modifiers", href: "/menu/modifiers", icon: Coffee, ready: true },
    {
      label: "Inventory",
      href: "/inventory",
      icon: Package,
      capability: "inventory.read",
      permission: "inventoryRead",
    },
    { label: "Stocktakes", href: "/inventory/stocktakes", icon: ClipboardCheck, capability: "inventory.read", permission: "inventoryRead" },
    {
      label: "Sales reports",
      href: "/reports",
      icon: Activity,
      capability: "reports.sales.read",
      permission: "reportsSalesRead",
    },
    {
      label: "Team",
      href: "/team",
      icon: Users,
      permission: "staffRead",
      ready: true,
    },
    {
      label: "Complaints & feedback",
      href: "/feedback",
      icon: MessageSquareText,
      ready: true,
    },
  ],
  CASHIER: [
    {
      label: "Point of sale",
      href: "/pos",
      icon: CreditCard,
      capability: "orders.create",
      ready: true,
    },
    { label: "My orders", href: "/orders", icon: ClipboardList, capability: "orders.read" },
    { label: "Shift", href: "/shift", icon: Clock3 },
    { label: "Receipts", href: "/orders", icon: ReceiptText, capability: "orders.read" },
    {
      label: "Complaints & feedback",
      href: "/feedback",
      icon: MessageSquareText,
      ready: true,
    },
  ],
  WAITER: [
    {
      label: "Tables",
      href: "/tables",
      icon: Store,
      capability: "orders.create",
      ready: true,
    },
    { label: "My orders", href: "/orders", icon: ClipboardList, capability: "orders.read" },
    {
      label: "Complaints & feedback",
      href: "/feedback",
      icon: MessageSquareText,
      ready: true,
    },
  ],
  KITCHEN_STAFF: [
    {
      label: "Kitchen queue",
      href: "/kitchen",
      icon: ChefHat,
      capability: "kitchen.orders.read",
      ready: true,
    },
  ],
  INVENTORY_MANAGER: [
    { label: "Stocktakes", href: "/inventory/stocktakes", icon: ClipboardCheck, capability: "inventory.read", ready: true },
    { label: "Stock", href: "/inventory", icon: Boxes, ready: true },
    {
      label: "Ingredients",
      href: "/inventory/ingredients",
      icon: Package,
      ready: true,
    },
    {
      label: "Suppliers",
      href: "/inventory/suppliers",
      icon: Truck,
      ready: true,
    },
    {
      label: "Purchases",
      href: "/inventory/purchases",
      icon: ShoppingBag,
      ready: true,
    },
    { label: "Stock reports", href: "/stock-reports", icon: Activity },
    {
      label: "Complaints & feedback",
      href: "/feedback",
      icon: MessageSquareText,
      ready: true,
    },
  ],
  PLATFORM_ADMIN: [
    { label: "Admin overview", href: "/admin", icon: ShieldCheck, ready: true },
    { label: "Businesses", href: "/admin", icon: Building2, ready: true },
    { label: "Plans & trials", href: "/plans", icon: Wallet },
    { label: "System health", href: "/health", icon: Activity },
  ],
};
