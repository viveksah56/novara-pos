import { Activity, Building2, CreditCard, LifeBuoy, LayoutDashboard, MessageSquareText } from "lucide-react";

export const superAdminNavigation = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Businesses", href: "/admin/businesses", icon: Building2 },
  { label: "Plans & billing", href: "/admin/plans", icon: CreditCard },
  { label: "Support staff", href: "/admin/support", icon: LifeBuoy },
  { label: "Complaints & feedback", href: "/admin/tickets", icon: MessageSquareText },
  { label: "System health", href: "/admin/system", icon: Activity },
];
export const supportNavigation = [
  { label: "Businesses", href: "/admin/businesses", icon: Building2 },
  { label: "Support desk", href: "/admin/support", icon: LifeBuoy },
  { label: "Complaints & feedback", href: "/admin/tickets", icon: MessageSquareText },
];
