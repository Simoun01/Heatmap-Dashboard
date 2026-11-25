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
          The dashboard couldn&apos;t reach its database. Check that <code>DATABASE_URL</code> is set, the schema is pushed (<code>npx prisma db push</code>) and
          seed data is loaded (<code>npx prisma db seed</code>).
        </p>
        <Button onClick={reset}>Try again</Button>
      </CardContent>
    </Card>
  );
}
