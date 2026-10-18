import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface QuantityControlProps {
  label: string;
  quantity: number;
  disabled?: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  className?: string;
}

export function QuantityControl({ label, quantity, disabled = false, onDecrease, onIncrease, className }: QuantityControlProps) {
  return <div className={`flex shrink-0 items-center gap-1.5 ${className ?? ""}`}>
    <Button type="button" size="icon-sm" variant="outline" aria-label={`Remove one ${label}`} title={`Remove one ${label}`} disabled={disabled || quantity <= 0} onClick={onDecrease}><Minus aria-hidden /></Button>
    <span className="min-w-6 text-center text-sm font-semibold tabular-nums" aria-live="polite">{quantity || ""}</span>
    <Button type="button" size="icon-sm" aria-label={`Add ${label}`} title={`Add ${label}`} disabled={disabled} onClick={onIncrease}><Plus aria-hidden /></Button>
  </div>;
}
