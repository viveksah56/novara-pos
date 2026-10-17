import { Suspense } from "react";
import { TenancySettings } from "@/features/tenancy/components/TenancySettings";
export default function BusinessSettingsPage() { return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/30"/>}><TenancySettings view="profile"/></Suspense>; }
