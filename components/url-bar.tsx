"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UrlBar() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  return (
    <form
      role="search"
      className="flex w-full max-w-3xl gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (url.trim()) router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
      }}
    >
      <label htmlFor="global-url" className="sr-only">
        Paste any URL to inspect, scrape and generate tracking
      </label>
      <Input
        id="global-url"
        type="text"
        inputMode="url"
        autoComplete="url"
        placeholder="Paste any URL to inspect, scrape & generate tracking"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Button type="submit" disabled={!url.trim()}>
        <ScanSearch aria-hidden />
        <span className="hidden sm:inline">Analyze</span>
      </Button>
    </form>
  );
}
