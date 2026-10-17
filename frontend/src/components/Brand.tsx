import Image from "next/image";
import Link from "next/link";

export function Brand({ light = false, href = "/login" }: { light?: boolean; href?: string }) {
  return (
    <Link href={href} aria-label="Novara home" className="inline-flex w-fit items-center gap-3 no-underline">
      <Image src="/logo.svg" alt="" aria-hidden width={38} height={38} priority />
      <span className={`font-semibold tracking-[-0.045em] ${light ? "text-white" : "text-foreground"}`}>
        <span className="text-[1.35rem]">novara</span>
        <span className={`ml-2 hidden text-[0.68rem] font-medium uppercase tracking-[0.2em] sm:inline ${light ? "text-white/55" : "text-muted-foreground"}`}>
          hospitality OS
        </span>
      </span>
    </Link>
  );
}
