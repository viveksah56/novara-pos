/** Poll only while the tab is visible; pass the result straight to `refetchInterval`. */
export function pollWhenVisible(intervalMs: number) {
  return () => (typeof document !== "undefined" && document.visibilityState === "visible" ? intervalMs : false);
}
