"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";

export function SnippetBox({ siteId }: { siteId: string }) {
  const [origin, setOrigin] = useState(process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "");
  useEffect(() => {
    if (!origin) setOrigin(window.location.origin);
  }, [origin]);

  const snippet = `<script src="${origin || "https://your-app.vercel.app"}/tracker.js" data-site-id="${siteId}" defer></script>`;
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">
          <code>{snippet}</code>
        </pre>
        <CopyButton value={snippet} />
      </div>
      <p className="text-xs text-muted-foreground">
        Paste before <code>&lt;/head&gt;</code>. Add <code>data-track-conversion=&quot;signup&quot;</code> to any button or form to count conversions, or call{" "}
        <code>window.utmhm(&quot;conversion&quot;, &quot;purchase&quot;)</code>.
      </p>
    </div>
  );
}
