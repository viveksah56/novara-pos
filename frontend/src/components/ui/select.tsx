"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; description?: string };

/** Shared branded select for forms and inline status controls. */
export function SelectField({
  value,
  onValueChange,
  options,
  placeholder = "Choose an option",
  disabled,
  required,
  className,
  triggerClassName,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  id,
  name,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  id?: string;
  name?: string;
}) {
  return (
    <SelectPrimitive.Root items={options.map(({ value: optionValue, label }) => ({ value: optionValue, label }))} value={value} onValueChange={(nextValue) => {
      if (typeof nextValue === "string") onValueChange(nextValue);
    }} disabled={disabled} required={required} name={name}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        className={cn(
          "inline-flex h-11 w-full items-center justify-start gap-3 rounded-xl border border-border/80 bg-background px-4 text-left text-sm text-foreground shadow-sm outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-55",
          triggerClassName,
        )}
      >
        <SelectPrimitive.Value className="min-w-0 flex-1 truncate text-left" placeholder={placeholder} />
        <SelectPrimitive.Icon><ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="z-[100] outline-none" sideOffset={6} alignItemWithTrigger={false}>
          <SelectPrimitive.Popup className={cn("max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl outline-none data-[ending-style]:translate-y-1 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-1 data-[starting-style]:opacity-0", className)}>
            <SelectPrimitive.List>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[selected]:font-medium"
                >
                  <span className="min-w-0 flex-1">
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    {option.description ? <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span> : null}
                  </span>
                  <SelectPrimitive.ItemIndicator><Check aria-hidden className="size-4 text-primary" /></SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
