"use client";

import { useTransition } from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { setCampaignStatus } from "@/app/actions";

export function CampaignStatus({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <NativeSelect
      aria-label="Campaign status"
      className="h-9 w-28"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as "active" | "paused" | "ended";
        startTransition(async () => {
          await setCampaignStatus(id, next);
        });
      }}
    >
      <option value="active">Active</option>
      <option value="paused">Paused</option>
      <option value="ended">Ended</option>
    </NativeSelect>
  );
}
