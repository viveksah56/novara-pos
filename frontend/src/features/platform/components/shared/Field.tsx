import type { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">{label}{children}</label>; }
