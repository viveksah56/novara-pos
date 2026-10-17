import { Suspense } from "react";
import { TenancySettings } from "@/features/tenancy/components/TenancySettings";
type Props = { params: Promise<{ id: string }> };
export default async function BranchDetailPage({ params }: Props) { const { id } = await params; return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/30"/>}><TenancySettings view="branch" branchId={id}/></Suspense>; }
