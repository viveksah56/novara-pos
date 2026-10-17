import { formatDateTime } from "@/lib/formatDateTime";

export function PlatformPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">{formatDateTime(new Date(), "en", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Kathmandu" })}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.03em] sm:text-[28px]">{title}</h2><p className="mt-1.5 text-sm text-muted-foreground">{description}</p></div></div>
  );
}
