import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) { return <div className="flex min-h-52 flex-col items-center justify-center px-5 py-10 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><Icon className="size-5" /></span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{description}</p></div>; }
