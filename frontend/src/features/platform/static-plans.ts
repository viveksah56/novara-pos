export type PublicPlan = {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  currency: string;
  trialDays: number;
  maxBranches: number | null;
  maxStaff: number | null;
  features: string[];
  featured?: boolean;
  customPrice?: boolean;
};

// Local launch catalog fallback; Platform Admin pricing from the API takes precedence.
export const staticPlans: PublicPlan[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Starter", description: "The essentials for one independent cafe.", priceMonthly: 0, currency: "NPR", trialDays: 0, maxBranches: 1, maxStaff: 5, features: ["Point of sale", "Menu and order management", "Daily sales overview", "Up to 5 team members"] },
  { id: "00000000-0000-4000-8000-000000000002", name: "Growth", description: "More control for ambitious hospitality teams.", priceMonthly: 2490, currency: "NPR", trialDays: 14, maxBranches: 3, maxStaff: 25, featured: true, features: ["Everything in Starter", "Inventory and supplier tools", "Team roles and permissions", "Multi-branch reporting", "Priority support"] },
  { id: "00000000-0000-4000-8000-000000000003", name: "Scale", description: "Flexible operations for growing multi-site groups.", priceMonthly: 6990, currency: "NPR", trialDays: 14, maxBranches: null, maxStaff: null, features: ["Everything in Growth", "Unlimited branches and staff", "Consolidated business reporting", "Guided onboarding", "Dedicated support"] },
];
