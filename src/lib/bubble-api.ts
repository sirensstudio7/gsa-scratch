/** Lightweight bubble sync — avoids loading hundreds of pop rows on every poll. */
export type BubbleListView = "full" | "total" | "recent";

export function bubblesFetchUrl(
  view: BubbleListView = "full",
  sinceId?: number,
): string {
  if (view === "total") return "/api/bubbles?view=total";
  if (view === "recent" && sinceId != null && sinceId >= 0) {
    return `/api/bubbles?view=recent&since=${Math.floor(sinceId)}`;
  }
  return "/api/bubbles";
}
