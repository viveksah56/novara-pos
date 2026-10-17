import { Suspense } from "react";
import { PlatformConsolePage } from "@/features/platform/components/PlatformConsole";

export default function BusinessDetailPage({ params }: { params: Promise<{ businessId: string }> }) {
  return <Suspense fallback={<div className="min-h-screen animate-pulse bg-secondary/35" />}><BusinessDetail params={params} /></Suspense>;
}

async function BusinessDetail({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return <PlatformConsolePage section="business-detail" businessId={businessId} />;
}
