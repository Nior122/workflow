"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Plus } from "lucide-react";
import {
  addSimulatedCredential,
  listCredentialsByProvider,
  type SimulatedCredential,
} from "@/lib/nodes/credentials";
import { Select } from "./fields";

export type CredentialPickerProps = {
  id?: string;
  provider: string;
  value: string;
  disabled?: boolean;
  onChange: (credentialId: string) => void;
};

/**
 * Simulated credentials picker: choose an existing connected account or run a fake
 * OAuth / API-key "Connect account" flow. No real secrets ever leave the browser.
 */
export function CredentialPicker({
  id,
  provider,
  value,
  disabled,
  onChange,
}: CredentialPickerProps) {
  const [credentials, setCredentials] = useState<SimulatedCredential[]>(() =>
    listCredentialsByProvider(provider),
  );
  const [connecting, setConnecting] = useState(false);
  const [accountLabel, setAccountLabel] = useState("");
  const [accountHandle, setAccountHandle] = useState("");

  const activeId = value || credentials[0]?.id || "";
  const activeCred = credentials.find((c) => c.id === activeId) ?? credentials[0];

  const handleConnect = () => {
    const label =
      accountLabel.trim() || `${provider.toUpperCase()} Production Account`;
    const handle =
      accountHandle.trim() || `connected@${provider.toLowerCase()}.simulated`;
    const created = addSimulatedCredential({
      provider,
      label,
      accountHint: handle,
    });
    setCredentials(listCredentialsByProvider(provider));
    onChange(created.id);
    setAccountLabel("");
    setAccountHandle("");
    setConnecting(false);
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-surface p-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Select
            id={id}
            value={activeId}
            disabled={disabled}
            options={credentials.map((cred) => ({
              value: cred.id,
              label: `${cred.label} (${cred.accountHint})`,
            }))}
            onChange={onChange}
          />
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setConnecting((v) => !v)}
          title="Connect a simulated account"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-2 text-[11px] font-medium text-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <Plus className="size-3" aria-hidden />
          Connect
        </button>
      </div>

      {activeCred && !connecting && (
        <p className="flex items-center gap-1 font-mono text-[11px] text-success">
          <CheckCircle2 className="size-3 shrink-0" aria-hidden />
          <span className="truncate">
            Connected: {activeCred.label} &middot; {activeCred.accountHint}
          </span>
        </p>
      )}

      {connecting && (
        <div className="space-y-2 rounded border border-accent/40 bg-background/70 p-2">
          <div className="flex items-center gap-1 font-mono text-[11px] font-medium text-accent">
            <KeyRound className="size-3" aria-hidden />
            Simulated OAuth / API key connection ({provider})
          </div>
          <input
            type="text"
            placeholder={`Account name (e.g. ${provider} Workspace)`}
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none"
          />
          <input
            type="text"
            placeholder="Account email / masked key (e.g. ops@company.com)"
            value={accountHandle}
            onChange={(e) => setAccountHandle(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConnecting(false)}
              className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConnect}
              className="rounded-md bg-gradient-ember px-2 py-1 text-[11px] font-medium text-accent-contrast"
            >
              Authorize &amp; Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
