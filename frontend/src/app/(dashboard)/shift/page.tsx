import { Suspense } from "react";
import { ShiftConsole } from "@/features/shifts/components/ShiftConsole";
export default function ShiftPage() { return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/30"/>}><ShiftConsole /></Suspense>; }
