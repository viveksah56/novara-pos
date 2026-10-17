"use client";

import { RouteFailure } from "@/components/layout/RouteFailure";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteFailure error={error} retry={retry} />;
}
