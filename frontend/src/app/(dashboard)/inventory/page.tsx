import { Suspense } from "react";
import { OperationsConsolePage } from "@/features/operations/components/OperationsConsole";

export default function InventoryPage() {
  return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/30"/>}><OperationsConsolePage module="inventory"/></Suspense>;
}
