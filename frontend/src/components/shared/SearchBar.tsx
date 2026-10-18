"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchBar({ value, onValueChange, placeholder = "Search…", ariaLabel, className, inputClassName, disabled = false }: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}) {
  return <div className={cn("relative w-full", className)}>
    <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      type="text"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn("h-10 pl-9", value ? "pr-10" : "pr-3", inputClassName)}
    />
    {value ? <button
      type="button"
      aria-label={`Clear ${ariaLabel.toLowerCase()}`}
      disabled={disabled}
      onClick={() => onValueChange("")}
      className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
    ><X aria-hidden className="size-4" /></button> : null}
  </div>;
}
