import type { ReactNode } from "react";

export interface QueryStateProps<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  isEmpty: (data: T) => boolean;
  loading: ReactNode;
  error: ReactNode;
  empty: ReactNode;
  children: (data: T) => ReactNode;
}

/** Typed loading, error, empty and success composition for query-backed views. */
export function QueryState<T>({ data, isPending, isError, isEmpty, loading, error, empty, children }: QueryStateProps<T>) {
  if (isPending) return loading;
  if (isError || data === undefined) return error;
  if (isEmpty(data)) return empty;
  return children(data);
}
