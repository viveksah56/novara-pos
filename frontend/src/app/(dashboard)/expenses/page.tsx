import { Suspense } from "react";
import { ExpensesPage } from "@/features/expenses/components/ExpensesPage";

export default function ExpensesRoute() {
  return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/30" />}><ExpensesPage /></Suspense>;
}
