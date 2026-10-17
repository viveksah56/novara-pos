import type { PlatformRole } from "@/features/platform/api";
import { BusinessDetailSection } from "@/features/platform/components/sections/BusinessDetailSection";
import { BusinessesSection } from "@/features/platform/components/sections/BusinessesSection";
import { OverviewSection } from "@/features/platform/components/sections/OverviewSection";
import { PlansSection } from "@/features/platform/components/sections/PlansSection";
import { PlatformTicketsSection } from "@/features/platform/components/sections/PlatformTicketsSection";
import { SupportStaffSection } from "@/features/platform/components/sections/SupportStaffSection";
import { SupportWorkspaceSection } from "@/features/platform/components/sections/SupportWorkspaceSection";
import { SystemSection } from "@/features/platform/components/sections/SystemSection";
import { StatePanel } from "@/features/platform/components/shared/StatePanel";
import type { PlatformSection } from "@/features/platform/types";

/** Picks the section for the current route and enforces which sections each platform role may open. */
export function PlatformSectionView({ section, businessId, platformRole }: { section: PlatformSection; businessId?: string; platformRole: PlatformRole }) {
  const superAdmin = platformRole === "SUPER_ADMIN";
  const allowedSection = superAdmin || ["businesses", "business-detail", "support", "tickets"].includes(section);
  if (!allowedSection) return <StatePanel title="This platform page is restricted" description="Your Support Agent role can search business workspaces but cannot change billing, system settings, or platform staff." />;
  switch (section) {
    case "overview": return <OverviewSection />;
    case "businesses": return <BusinessesSection canManage={superAdmin} />;
    case "business-detail": return businessId ? <BusinessDetailSection businessId={businessId} canManage={superAdmin} /> : <StatePanel title="Business details are unavailable" description="No business was selected." />;
    case "plans": return <PlansSection />;
    case "system": return <SystemSection />;
    case "tickets": return <PlatformTicketsSection canResolveBusinessComplaints={superAdmin} />;
    default: return superAdmin ? <SupportStaffSection /> : <SupportWorkspaceSection />;
  }
}
