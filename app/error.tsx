"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error.digest ?? "dashboard error");
  }, [error]);

  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <CardContent className="space-y-3 p-6">
        <h1 className="text-lg font-semibold">This view couldn&apos;t load</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong loading this page. If the problem persists, check your connection and try refreshing.
        </p>
        <Button onClick={reset}>Try again</Button>
      </CardContent>
    </Card>
  );
}
