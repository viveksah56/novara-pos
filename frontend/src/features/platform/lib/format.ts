import { formatDateTime } from "@/lib/formatDateTime";

export function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase(); }
export function shortDate(value: string) { return formatDateTime(new Date(value), "en", { month: "short", day: "numeric", year: "numeric" }); }
export function formatUptime(seconds: number) { const days = Math.floor(seconds / 86400); const hours = Math.floor((seconds % 86400) / 3600); const minutes = Math.floor((seconds % 3600) / 60); return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`; }
