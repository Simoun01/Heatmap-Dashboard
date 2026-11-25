import Link from "next/link";
import { cn } from "@/lib/utils";
import { RANGES, type RangeKey } from "@/lib/analytics";

export function RangeTabs({ current, basePath = "/" }: { current: RangeKey; basePath?: string }) {
  return (
    <div className="inline-flex h-10 items-center rounded-md bg-muted p-1" role="group" aria-label="Date range">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={`${basePath}?range=${r}`}
          scroll={false}
          aria-current={r === current ? "true" : undefined}
          className={cn(
            "rounded-sm px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            r === current ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r}
        </Link>
      ))}
    </div>
  );
}
