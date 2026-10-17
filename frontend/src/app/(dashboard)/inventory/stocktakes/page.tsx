import { Suspense } from "react";
import { StocktakeConsole } from "@/features/inventory/components/StocktakeConsole";

export default function InventoryStocktakesPage() {
  return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/30" />}><StocktakeConsole /></Suspense>;
}
