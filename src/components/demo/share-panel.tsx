"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DEFAULT_SHARE_DAYS, shareState, type DemoShare } from "@/lib/demo-share";
import { formatTimestamp } from "@/lib/format";

/**
 * Issue, copy and withdraw the links that let a business see its own demo.
 *
 * A Client Component because it owns a request lifecycle and the clipboard.
 * The list itself is rendered from data the SERVER read, so the panel never
 * shows a link it has not seen come back from the store.
 *
 * Creating a link is always one deliberate click. Nothing is shared on
 * generation: a link that appears without anyone deciding to create it is a
 * link nobody remembers to revoke.
 */

const DURATIONS = [7, 30, 90] as const;

export function SharePanel({ demoId, shares }: { demoId: string; shares: DemoShare[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number>(DEFAULT_SHARE_DAYS);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isRefreshing, startTransition] = useTransition();

  const working = busy || isRefreshing;
  const live = shares.filter((share) => shareState(share) === "active");

  /** Absolute URL, built in the browser: the server does not reliably know the
   *  public origin, and a guessed one produces a link that fails in someone's
   *  hands. */
  const absolute = (path: string) =>
    typeof window === "undefined" ? path : `${window.location.origin}${path}`;

  async function create() {
    if (working) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/demos/${demoId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(typeof body?.error === "string" ? body.error : "Could not create a link.");
        return;
      }
      setNote("");
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(shareId: string) {
    if (working) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/demos/${demoId}/share`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      });
      if (!response.ok) {
        setError("Could not revoke that link.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    const url = absolute(`/s/${token}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard access can be refused. Say so rather than appearing to work.
      setError("Could not copy. Select the link and copy it by hand.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
      >
        Share{live.length > 0 ? ` (${live.length})` : ""}
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-100">Share this demo</p>
          <p className="mt-0.5 text-slate-400">
            Creates a link the business can open without signing in. Every link expires,
            and you can withdraw one at any time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-slate-800"
        >
          Close
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-slate-400">Expires in</span>
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
          >
            {DURATIONS.map((option) => (
              <option key={option} value={option}>
                {option} days
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-48 flex-1 flex-col gap-1">
          <span className="text-slate-400">Note to yourself (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            placeholder="Left with the owner on Tuesday"
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 placeholder:text-slate-600"
          />
        </label>

        <button
          type="button"
          onClick={create}
          disabled={working}
          className="rounded bg-amber-400 px-3 py-1.5 font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
        >
          {busy ? "Creating..." : "Create link"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 rounded bg-red-950/60 px-2 py-1 text-red-300">
          {error}
        </p>
      ) : null}

      {shares.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-800 border-t border-slate-800">
          {shares.map((share) => {
            const state = shareState(share);
            return (
              <li key={share.id} className="flex flex-wrap items-center gap-2 py-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    state === "active"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-slate-700/50 text-slate-400"
                  }`}
                >
                  {state}
                </span>

                <code className="min-w-0 flex-1 truncate text-slate-300">
                  {absolute(`/s/${share.token}`)}
                </code>

                {state === "active" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => copy(share.token)}
                      className="rounded border border-slate-700 px-2 py-0.5 text-slate-200 hover:bg-slate-800"
                    >
                      {copied === share.token ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => revoke(share.id)}
                      disabled={working}
                      className="rounded border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                    >
                      Revoke
                    </button>
                  </>
                ) : null}

                <span className="w-full text-[11px] text-slate-500">
                  {state === "revoked" && share.revokedAt
                    ? `Withdrawn ${formatTimestamp(share.revokedAt)}`
                    : `Expires ${formatTimestamp(share.expiresAt)}`}
                  {share.note ? ` · ${share.note}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 border-t border-slate-800 pt-3 text-slate-500">
          No links yet. Nothing is shared until you create one.
        </p>
      )}
    </div>
  );
}
