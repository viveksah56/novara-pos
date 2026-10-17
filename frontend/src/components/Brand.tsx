import Image from "next/image";
import Link from "next/link";

export function Brand({ light = false, href = "/login" }: { light?: boolean; href?: string }) {
  return (
    <Link href={href} aria-label="Novara home" className="inline-flex w-fit shrink-0 items-center gap-2.5 no-underline">
      <Image src="/logo.svg" alt="" aria-hidden width={38} height={38} priority className="size-[38px] shrink-0" />
      <span className={`flex items-baseline gap-2 whitespace-nowrap font-semibold tracking-[-0.045em] ${light ? "text-white" : "text-foreground"}`}>
        <span className="text-[1.3rem]">Novara</span>
        <span className={`hidden text-[0.58rem] font-medium uppercase tracking-[0.16em] lg:inline ${light ? "text-white/55" : "text-muted-foreground"}`}>
          hospitality OS
        </span>
      </span>
    </Link>
  );
}
