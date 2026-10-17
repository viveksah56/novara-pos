import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { AuthUser } from "@/features/auth/types";
import type { PlatformRole } from "@/features/platform/api";
import { PlatformSectionView } from "@/features/platform/components/sections/PlatformSectionView";
import { PlatformFooter } from "@/features/platform/components/shell/PlatformFooter";
import { PlatformHeader } from "@/features/platform/components/shell/PlatformHeader";
import { PlatformNotice } from "@/features/platform/components/shell/PlatformNotice";
import { PlatformPageHeader } from "@/features/platform/components/shell/PlatformPageHeader";
import { PlatformSidebar } from "@/features/platform/components/shell/PlatformSidebar";
import { getPageMeta } from "@/features/platform/config/pageMeta";
import { PlatformActionsProvider } from "@/features/platform/context/PlatformActionsContext";
import type { PlatformSection } from "@/features/platform/types";

type PlatformShellProps = {
  section: PlatformSection;
  businessId?: string;
  user: AuthUser;
  platformRole: PlatformRole;
};

/** Platform workspace frame: sidebar, header, notice banner, and the active section. */
export function PlatformShell({ section, businessId, user, platformRole }: PlatformShellProps) {
  const pathname = usePathname();
  const { title, description } = getPageMeta(section, platformRole);
  return (
    <SidebarProvider>
      <PlatformSidebar platformRole={platformRole} pathname={pathname} />
      <PlatformActionsProvider>
        <SidebarInset>
          <PlatformHeader title={title} user={user} platformRole={platformRole} />
          <div className="mx-auto w-full max-w-[1480px] p-4 pb-10 sm:p-7 xl:px-10 xl:py-8">
            <PlatformPageHeader title={title} description={description} />
            <PlatformNotice />
            <PlatformSectionView section={section} businessId={businessId} platformRole={platformRole} />
            <PlatformFooter platformRole={platformRole} />
          </div>
        </SidebarInset>
      </PlatformActionsProvider>
    </SidebarProvider>
  );
}
