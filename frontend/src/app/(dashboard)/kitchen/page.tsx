import { Suspense } from "react";
import { KitchenQueueWorkspace } from "@/features/pos/components/KitchenQueueWorkspace";

export default function KitchenPage() {
  return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/30" />}><KitchenQueueWorkspace /></Suspense>;
}
