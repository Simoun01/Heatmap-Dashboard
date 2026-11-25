"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSite } from "@/app/actions";

export function SiteForm() {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const r = await createSite({ name, domain });
          if (r.ok) {
            setName("");
            setDomain("");
          } else setError(r.error);
        });
      }}
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="site-name">Site name</Label>
        <Input id="site-name" required maxLength={80} placeholder="Main website" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="site-domain">Domain</Label>
        <Input id="site-domain" required placeholder="www.example.com" value={domain} onChange={(e) => setDomain(e.target.value)} aria-describedby="site-err" />
      </div>
      <Button type="submit" disabled={pending || !name.trim() || !domain.trim()}>
        <Plus aria-hidden /> {pending ? "Adding…" : "Add site"}
      </Button>
      {error && (
        <p id="site-err" role="alert" className="text-sm text-destructive sm:basis-full">
          {error}
        </p>
      )}
    </form>
  );
}
