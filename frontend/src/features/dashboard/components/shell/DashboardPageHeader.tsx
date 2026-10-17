import { roleDescriptions } from "@/features/dashboard/config/roles";
import { formatDateTime } from "@/lib/formatDateTime";

type DashboardPageHeaderProps = {
  role: string;
  userName: string;
  dataStatus?: "NO_OPERATIONAL_DATA";
  onRefresh: () => void;
};

function greeting(hour: number) {
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

/** Date, personalised greeting, role blurb, and the refresh control. */
export function DashboardPageHeader({ role, userName, dataStatus, onRefresh }: DashboardPageHeaderProps) {
  const now = new Date();
  const date = formatDateTime(now, "en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">{date}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-.03em] sm:text-[28px]">{`Good ${greeting(now.getHours())}, ${userName.split(" ")[0]}`}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {roleDescriptions[role]}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {dataStatus === "NO_OPERATIONAL_DATA" && role !== "PLATFORM_ADMIN" ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Awaiting sales data
          </span>
        ) : null}
        <button
          onClick={onRefresh}
          className="rounded-lg border border-border/70 bg-card px-3 py-2 text-xs font-medium hover:bg-secondary"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
