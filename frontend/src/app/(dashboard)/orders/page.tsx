import { Suspense } from "react";
import { PosOrdersPage } from "@/features/pos/components/PosOrdersPage";
export default function OrdersPage() { return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/30"/>}><PosOrdersPage /></Suspense>; }
