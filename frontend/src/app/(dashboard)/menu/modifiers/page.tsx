import { Suspense } from "react";
import { ModifierManager } from "@/features/menu/components/ModifierManager";

export default function MenuModifiersPage() {
  return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/30" />}><ModifierManager /></Suspense>;
}
