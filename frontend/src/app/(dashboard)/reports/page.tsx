import { Suspense } from "react";
import { ReportConsole } from "@/features/reports/components/ReportConsole";
export default function ReportsPage() { return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/30"/>}><ReportConsole kind="sales" /></Suspense>; }
