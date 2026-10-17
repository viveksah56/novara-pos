import { Suspense } from "react";
import { TablesWorkspace } from "@/features/pos/components/TablesWorkspace";

export default function TablesPage() {
  return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/30" />}><TablesWorkspace /></Suspense>;
}
